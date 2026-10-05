import { Timestamp, addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

const examsCollection = collection(db, 'examenes')

/** Guarda un examen y deja que Firestore genere el ID del documento. */
export async function crearExamen(datosExamen) {
  return addDoc(examsCollection, datosExamen)
}

/** Devuelve únicamente los exámenes creados por el profesor indicado. */
export async function obtenerExamenesPorProfesor(profesorId) {
  const examsQuery = query(examsCollection, where('profesorId', '==', String(profesorId)))
  const snapshot = await getDocs(examsQuery)

  return snapshot.docs
    .map((exam) => ({ id: exam.id, ...exam.data() }))
    .sort((first, second) => (second.fechaInicio?.toMillis?.() ?? 0) - (first.fechaInicio?.toMillis?.() ?? 0))
}

export async function obtenerExamenPorId(examId) {
  const snapshot = await getDoc(doc(db, 'examenes', examId))
  if (!snapshot.exists()) throw new Error('El examen solicitado ya no existe.')
  return { id: snapshot.id, ...snapshot.data() }
}

export async function actualizarExamen(examId, datosExamen) {
  return updateDoc(doc(db, 'examenes', examId), datosExamen)
}

export async function borrarExamen(examId) {
  return deleteDoc(doc(db, 'examenes', examId))
}

export const dateAndTimeToTimestamp = (date, time) => Timestamp.fromDate(new Date(`${date}T${time}`))
