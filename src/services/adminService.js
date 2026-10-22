import {
  arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, limit, serverTimestamp,
  query, runTransaction, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { addedCourseMembership, changedCourseMembership } from '../features/admin/adminRules'
import { getSessionLegajo } from './authService'

const users = collection(db, 'users')
const courses = collection(db, 'cursos')
const exams = collection(db, 'examenes')
const attempts = collection(db, 'examenesEntregados')

const adminLegajo = () => {
  const legajo = getSessionLegajo()
  if (!legajo) throw new Error('La sesión del administrador no es válida.')
  return validLegajo(legajo)
}

async function assertAdmin() {
  const legajo = adminLegajo()
  const snapshot = await getDoc(doc(users, String(legajo)))
  if (!snapshot.exists() || snapshot.data().rol !== 'admin' || snapshot.data().activo !== true) {
    throw new Error('Esta operación requiere un administrador activo.')
  }
  return legajo
}

const withoutCredentials = (profile) => {
  const { passwordHash, passwordSalt, ...data } = profile
  return { ...data, claveFirestoreConfigurada: Boolean(passwordHash && passwordSalt) }
}

function auditEntry(action, target) {
  return { accion: action, objetivo: target, legajoAdmin: adminLegajo(), fecha: serverTimestamp() }
}

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

export async function obtenerUsuarioAdmin(legajo) {
  const parsed = validLegajo(legajo)
  const snapshot = await getDoc(doc(users, String(parsed)))
  if (!snapshot.exists()) throw new Error('El usuario ya no existe.')
  return { id: snapshot.id, ...withoutCredentials(snapshot.data()) }
}

export async function obtenerCursoAdmin(code) {
  const snapshot = await getDoc(doc(courses, String(code)))
  if (!snapshot.exists()) throw new Error('La materia ya no existe.')
  return { id: snapshot.id, ...snapshot.data() }
}

export async function actualizarUsuarioAdmin({ legajo, rol, nombre, apellido, cursosActivos = [] }) {
  const parsed = validLegajo(legajo)
  const courseCodes = rol === 'alumno' ? uniqueTexts(cursosActivos) : []
  const ref = doc(users, String(parsed))
  const current = await getDoc(ref)
  if (!current.exists() || current.data().rol !== rol) throw new Error('El usuario no existe o cambió de rol.')
  const previousCourses = current.data().cursosActivos ?? []
  const movingStudent = rol === 'alumno' && changedCourseMembership(previousCourses, courseCodes)
  if (movingStudent) {
    const snapshot = await getDocs(query(attempts, where('legajoAlumno', '==', parsed)))
    if (snapshot.docs.some((item) => item.data().estadoEntrega === 'en_curso')) {
      throw new Error('No se pueden cambiar los cursos de un alumno con un examen en curso.')
    }
  }
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists() || snapshot.data().rol !== rol) throw new Error('El usuario no existe o cambió de rol.')
    if (rol === 'alumno') {
      if (snapshot.data().activo === false && addedCourseMembership(snapshot.data().cursosActivos ?? [], courseCodes)) {
        throw new Error('No se puede inscribir a un usuario dado de baja. Primero dalo de alta.')
      }
      for (const code of courseCodes) {
        const course = await transaction.get(doc(courses, code))
        if (!course.exists()) throw new Error(`El curso ${code} no existe.`)
      }
    }
    transaction.update(ref, {
      nombre: requiredText(nombre, 'el nombre'),
      apellido: requiredText(apellido, 'el apellido'),
      ...(rol === 'alumno' ? { cursosActivos: courseCodes } : {}),
    })
    transaction.set(doc(collection(db, 'auditoria')), auditEntry('editar_usuario', String(parsed)))
  })
}

export async function actualizarCursoAdmin({ idCurso, materia, legajoProfe, comisiones = [] }) {
  const code = requiredText(idCurso, 'el código del curso')
  const professorId = validLegajo(legajoProfe)
  const commissions = uniqueTexts(comisiones)
  if (!commissions.length) throw new Error('Agregá al menos una comisión.')
  const courseRef = doc(courses, code)
  const current = await getDoc(courseRef)
  if (!current.exists()) throw new Error('La materia ya no existe.')
  const existingExams = await getDocs(query(exams, where('cursoCodigo', '==', code)))
  if (existingExams.docs.length) {
    if (Number(current.data().legajoProfe) !== professorId) {
      throw new Error('No se puede cambiar el profesor de un curso con exámenes creados.')
    }
    if (existingExams.docs.some((item) => !commissions.includes(item.data().comisionId))) {
      throw new Error('No se puede quitar una comisión que ya tiene exámenes.')
    }
  }
  await runTransaction(db, async (transaction) => {
    const course = await transaction.get(courseRef)
    if (!course.exists()) throw new Error('La materia ya no existe.')
    const oldId = Number(course.data().legajoProfe)
    const oldRef = Number.isSafeInteger(oldId) ? doc(users, String(oldId)) : null
    const newRef = doc(users, String(professorId))
    const oldProfessor = oldRef ? await transaction.get(oldRef) : null
    const newProfessor = await transaction.get(newRef)
    if (!newProfessor.exists() || newProfessor.data().rol !== 'profesor' || newProfessor.data().activo !== true) {
      throw new Error('Seleccioná un profesor activo.')
    }
    transaction.update(courseRef, {
      materia: requiredText(materia, 'el nombre de la materia'),
      legajoProfe: professorId,
      comisiones: commissions,
    })
    if (oldId !== professorId) {
      if (oldProfessor?.exists()) transaction.update(oldRef, { cursosActivos: arrayRemove(code) })
      transaction.update(newRef, { cursosActivos: arrayUnion(code) })
    }
    transaction.set(doc(collection(db, 'auditoria')), auditEntry('editar_curso', code))
  })
}

export async function cambiarEstadoUsuarioAdmin(legajo, activo) {
  const adminId = await assertAdmin()
  const targetId = validLegajo(legajo)
  if (targetId === adminId) throw new Error('No podés modificar tu propio estado.')
  const targetRef = doc(users, String(targetId))
  const target = await getDoc(targetRef)
  if (!target.exists() || !['alumno', 'profesor'].includes(target.data().rol)) throw new Error('Sólo se pueden modificar alumnos y profesores.')
  if (!activo && target.data().rol === 'alumno') {
    const inProgress = await getDocs(query(attempts, where('legajoAlumno', '==', targetId)))
    if (inProgress.docs.some((item) => item.data().estadoEntrega === 'en_curso')) {
      throw new Error('No se puede dar de baja a un alumno con un examen en curso.')
    }
  }
  if (!activo && target.data().rol === 'profesor') {
    const assigned = await getDocs(query(courses, where('legajoProfe', '==', targetId), limit(1)))
    if (!assigned.empty) throw new Error('Reasigná los cursos del profesor antes de darlo de baja.')
  }
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(targetRef)
    if (!current.exists() || !['alumno', 'profesor'].includes(current.data().rol)) throw new Error('El usuario ya no existe.')
    transaction.update(targetRef, { activo: Boolean(activo) })
    transaction.set(doc(collection(db, 'auditoria')), auditEntry(activo ? 'dar_de_alta' : 'dar_de_baja', String(targetId)))
  })
}

export async function restablecerContrasenaAdmin(legajo) {
  const adminId = await assertAdmin()
  const targetId = validLegajo(legajo)
  if (targetId === adminId) throw new Error('No podés blanquear tu propia contraseña desde esta sesión.')
  const targetRef = doc(users, String(targetId))
  await runTransaction(db, async (transaction) => {
    const target = await transaction.get(targetRef)
    if (!target.exists()) throw new Error('El usuario no existe.')
    if (!['alumno', 'profesor'].includes(target.data().rol)) throw new Error('Sólo se pueden restablecer cuentas de alumnos y profesores.')
    transaction.update(targetRef, { contrasenaActiva: false, passwordHash: deleteField(), passwordSalt: deleteField() })
    transaction.set(doc(collection(db, 'auditoria')), auditEntry('blanquear_contrasena', String(targetId)))
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
