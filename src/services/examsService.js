import { Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore'
import { db } from '../firebase'
import { getExamSchedule, isExamEditable } from '../utils/examWindow'

const examsCollection = collection(db, 'examenes')

/** Guarda un examen y deja que Firestore genere el ID del documento. */
export async function crearExamen(datosExamen) {
  return addDoc(examsCollection, datosExamen)
}

/** Devuelve únicamente los exámenes creados por el profesor indicado. */
export async function obtenerExamenesPorProfesor(legajoProfe) {
  const examsQuery = query(examsCollection, where('legajoProfe', '==', Number(legajoProfe)))
  const snapshot = await getDocs(examsQuery)

  return snapshot.docs
    .map((exam) => ({ id: exam.id, ...exam.data() }))
    .sort((first, second) => (second.fechaInicio?.toMillis?.() ?? 0) - (first.fechaInicio?.toMillis?.() ?? 0))
}

/** Exámenes habilitados para alguno de los códigos de curso indicados. */
export async function obtenerExamenesPorCursos(courseCodes) {
  if (!courseCodes.length) return []
  const snapshot = await getDocs(examsCollection)
  return snapshot.docs
    .map((exam) => ({ id: exam.id, ...exam.data() }))
    .filter((exam) => courseCodes.includes(exam.cursoCodigo) && ['programado', 'reprogramado', 'en_curso', 'finalizado', 'para_corregir', 'cerrado'].includes(exam.estado))
    .sort((first, second) => (first.fechaInicio?.toMillis?.() ?? 0) - (second.fechaInicio?.toMillis?.() ?? 0))
}

export async function obtenerExamenPorId(examId) {
  const snapshot = await getDoc(doc(db, 'examenes', examId))
  if (!snapshot.exists()) throw new Error('El examen solicitado ya no existe.')
  return { id: snapshot.id, ...snapshot.data() }
}

export async function actualizarExamen(examId, datosExamen, legajoProfe) {
  const ref = doc(db, 'examenes', examId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('El examen ya no existe.')
    const current = snapshot.data()
    if (Number(current.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para editar este examen.')
    if (!isExamEditable(current)) throw new Error('Este examen ya está en curso o finalizado y no se puede editar.')

    const originalStart = getExamSchedule(current)?.startMs
    const newStart = getExamSchedule(datosExamen)?.startMs
    const dateChanged = originalStart !== newStart
    const estado = current.estado === 'borrador' ? 'borrador' : dateChanged ? 'reprogramado' : current.estado
    transaction.update(ref, { ...datosExamen, estado })
    return estado
  })
}

export async function borrarExamen(examId) {
  return deleteDoc(doc(db, 'examenes', examId))
}

export const dateAndTimeToTimestamp = (date, time) => Timestamp.fromDate(new Date(`${date}T${time}`))
