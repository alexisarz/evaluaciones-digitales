import {
  arrayRemove, arrayUnion, collection, doc, getDocs, limit,
  query, runTransaction, where,
} from 'firebase/firestore'
import { db } from '../firebase'

const users = collection(db, 'users')
const courses = collection(db, 'cursos')

function requiredText(value, label) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`Completá ${label}.`)
  return text
}

function validLegajo(value) {
  const text = String(value ?? '').trim()
  const number = Number(text)
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number <= 0) {
    throw new Error('El legajo debe ser un número entero positivo.')
  }
  return number
}

function uniqueTexts(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]
}

export async function crearUsuarioAdmin({ legajo, nombre, apellido, rol, cursosActivos = [] }) {
  if (!['alumno', 'profesor'].includes(rol)) throw new Error('Rol no permitido para esta alta.')
  const parsedLegajo = validLegajo(legajo)
  const courseCodes = uniqueTexts(cursosActivos)
  const profile = {
    legajo: parsedLegajo,
    nombre: requiredText(nombre, 'el nombre'),
    apellido: requiredText(apellido, 'el apellido'),
    rol,
    activo: true,
    contrasenaActiva: false,
    cursosActivos: rol === 'alumno' ? courseCodes : [],
    ...(rol === 'alumno' ? { notas: [] } : {}),
  }
  const userRef = doc(users, String(parsedLegajo))

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(userRef)
    if (existing.exists()) throw new Error(`El legajo ${parsedLegajo} ya existe.`)
    if (rol === 'alumno') {
      for (const code of courseCodes) {
        const course = await transaction.get(doc(courses, code))
        if (!course.exists()) throw new Error(`El curso ${code} no existe.`)
      }
    }
    transaction.set(userRef, profile)
  })
  return profile
}

export async function crearCursoAdmin({ idCurso, materia, legajoProfe, comisiones = [] }) {
  const code = requiredText(idCurso, 'el código del curso')
  if (code.includes('/')) throw new Error('El código del curso no puede contener “/”.')
  const parsedProfessor = validLegajo(legajoProfe)
  const commissions = uniqueTexts(comisiones)
  if (!commissions.length) throw new Error('Agregá al menos una comisión.')
  const course = {
    idCurso: code,
    materia: requiredText(materia, 'el nombre de la materia'),
    legajoProfe: parsedProfessor,
    comisiones: commissions,
  }
  const courseRef = doc(courses, code)
  const professorRef = doc(users, String(parsedProfessor))

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(courseRef)
    const professor = await transaction.get(professorRef)
    if (existing.exists()) throw new Error(`El curso ${code} ya existe.`)
    if (!professor.exists() || professor.data().rol !== 'profesor' || professor.data().activo !== true) {
      throw new Error('El legajo indicado no corresponde a un profesor activo.')
    }
    transaction.set(courseRef, course)
    transaction.update(professorRef, { cursosActivos: arrayUnion(code) })
  })
  return course
}

export async function eliminarCursoAdmin(code) {
  const courseRef = doc(courses, code)
  const [enrolled, exams] = await Promise.all([
    getDocs(query(users, where('cursosActivos', 'array-contains', code))),
    getDocs(query(collection(db, 'examenes'), where('cursoCodigo', '==', code), limit(1))),
  ])
  if (enrolled.docs.some((item) => item.data().rol === 'alumno') || !exams.empty) {
    throw new Error('No se puede eliminar: el curso tiene usuarios inscriptos o exámenes asociados.')
  }

  await runTransaction(db, async (transaction) => {
    const course = await transaction.get(courseRef)
    if (!course.exists()) throw new Error('El curso ya no existe.')
    const professorId = course.data().legajoProfe
    const professorRef = Number.isSafeInteger(Number(professorId)) ? doc(users, String(professorId)) : null
    const professor = professorRef ? await transaction.get(professorRef) : null
    transaction.delete(courseRef)
    if (professor?.exists()) transaction.update(professorRef, { cursosActivos: arrayRemove(code) })
  })
}

export async function importarRegistrosAdmin(type, records, onProgress) {
  let created = 0
  const failures = []
  for (const [index, row] of records.entries()) {
    try {
      if (type === 'cursos') {
        await crearCursoAdmin({
          idCurso: row.idCurso ?? row.codigo,
          materia: row.materia ?? row.nombre,
          legajoProfe: row.legajoProfe,
          comisiones: String(row.comisiones ?? '').split('|'),
        })
      } else {
        await crearUsuarioAdmin({
          legajo: row.legajo,
          nombre: row.nombre,
          apellido: row.apellido,
          rol: type === 'alumnos' ? 'alumno' : 'profesor',
          cursosActivos: String(row.cursosActivos ?? '').split('|'),
        })
      }
      created += 1
    } catch (error) {
      failures.push(`Fila ${index + 2}: ${error.message}`)
    }
    onProgress?.(index + 1, records.length)
  }
  return { created, failures }
}
