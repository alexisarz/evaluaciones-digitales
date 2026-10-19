import { Timestamp, addDoc, collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore'
import { db } from '../firebase'
import { getExamSchedule, isExamEditable } from '../utils/examWindow'
import { assertExamCanPublish, assertValidQuestionScores, isExamArchivable, isExamDeletable } from '../features/teacherExams/examRules'

const examsCollection = collection(db, 'examenes')

/** Guarda un examen y deja que Firestore genere el ID del documento. */
export async function crearExamen(datosExamen) {
  assertValidQuestionScores(datosExamen.temas)
  if (datosExamen.estado !== 'borrador') assertExamCanPublish(datosExamen)
  return addDoc(examsCollection, { ...datosExamen, archivado: false })
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
    if (current.archivado || !isExamEditable(current)) throw new Error('Este examen ya está en curso, finalizado o archivado y no se puede editar.')

    const originalStart = getExamSchedule(current)?.startMs
    const newStart = getExamSchedule(datosExamen)?.startMs
    const dateChanged = originalStart !== newStart
    const estado = current.estado === 'borrador'
      ? datosExamen.estado === 'programado' ? 'programado' : 'borrador'
      : dateChanged ? 'reprogramado' : current.estado
    assertValidQuestionScores(datosExamen.temas)
    if (estado !== 'borrador') assertExamCanPublish(datosExamen)
    transaction.update(ref, { ...datosExamen, estado })
    return estado
  })
}

export async function borrarExamen(examId, legajoProfe) {
  const ref = doc(db, 'examenes', examId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('El examen ya no existe.')
    const exam = snapshot.data()
    if (Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para borrar este examen.')
    if (!isExamDeletable(exam)) throw new Error('No se pueden borrar exámenes en curso, finalizados o archivados.')
    transaction.delete(ref)
  })
}

export async function archivarExamen(examId, legajoProfe) {
  const ref = doc(db, 'examenes', examId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('El examen ya no existe.')
    const exam = snapshot.data()
    if (Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para archivar este examen.')
    if (!isExamArchivable(exam)) throw new Error('Sólo se pueden archivar exámenes finalizados.')
    transaction.update(ref, { archivado: true })
  })
}

export const dateAndTimeToTimestamp = (date, time) => Timestamp.fromDate(new Date(`${date}T${time}`))
