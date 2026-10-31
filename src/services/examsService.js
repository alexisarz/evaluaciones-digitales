import { Timestamp, addDoc, collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import { getEffectiveExamStatus, getExamSchedule, isExamEditable } from '../utils/examWindow'
import { assertExamCanPublish, assertValidQuestionScores, isExamArchivable, isExamDeletable } from '../features/teacherExams/examRules'
import { mergeExpectedAnswers, withoutExpectedAnswers } from '../features/teacherExams/expectedAnswers'
import { sortNewestFirst } from '../shared/sortByCreation'

const examsCollection = collection(db, 'examenes')
const legacyAnswersRef = (examId) => doc(db, 'respuestasEsperadas', examId)

/** Guarda un examen y deja que Firestore genere el ID del documento. */
export async function crearExamen(datosExamen) {
  assertValidQuestionScores(datosExamen.temas)
  if (datosExamen.estado !== 'borrador') assertExamCanPublish(datosExamen)
  return addDoc(examsCollection, { ...datosExamen, archivado: false, fechaCreacion: serverTimestamp() })
}

/** Devuelve únicamente los exámenes creados por el profesor indicado. */
export async function obtenerExamenesPorProfesor(legajoProfe) {
  const examsQuery = query(examsCollection, where('legajoProfe', '==', Number(legajoProfe)))
  const snapshot = await getDocs(examsQuery)

  return sortNewestFirst(snapshot.docs.map((exam) => ({ id: exam.id, ...exam.data() })))
}

/** Exámenes habilitados para alguno de los códigos de curso indicados. */
export async function obtenerExamenesPorCursos(courseCodes) {
  if (!courseCodes.length) return []
  const snapshot = await getDocs(examsCollection)
  return sortNewestFirst(snapshot.docs
    .map((exam) => ({ id: exam.id, ...exam.data(), temas: withoutExpectedAnswers(exam.data().temas) }))
    .filter((exam) => courseCodes.includes(exam.cursoCodigo) && ['programado', 'reprogramado', 'en_curso', 'finalizado', 'para_corregir', 'cerrado'].includes(exam.estado)))
}

export async function obtenerExamenPorId(examId, legajoProfe) {
  const ref = doc(db, 'examenes', examId)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) throw new Error('El examen solicitado ya no existe.')
  const exam = snapshot.data()
  if (Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para editar este examen.')
  // Migra una respuesta guardada con la estructura anterior al documento del examen.
  const oldSnapshot = await getDoc(legacyAnswersRef(examId))
  if (!oldSnapshot.exists()) return { id: snapshot.id, ...exam }
  return runTransaction(db, async (transaction) => {
    const [currentSnapshot, legacySnapshot] = await Promise.all([
      transaction.get(ref), transaction.get(legacyAnswersRef(examId)),
    ])
    if (!currentSnapshot.exists() || Number(currentSnapshot.data().legajoProfe) !== Number(legajoProfe)) {
      throw new Error('No tenés permiso para editar este examen.')
    }
    const current = currentSnapshot.data()
    if (!legacySnapshot.exists()) return { id: examId, ...current }
    if (Number(legacySnapshot.data().legajoProfe) !== Number(legajoProfe)) {
      throw new Error('No tenés acceso a las respuestas esperadas de este examen.')
    }
    const temas = mergeExpectedAnswers(current.temas, legacySnapshot.data().temas)
    transaction.update(ref, { temas })
    transaction.delete(legacyAnswersRef(examId))
    return { id: examId, ...current, temas }
  })
}

export async function actualizarExamen(examId, datosExamen, legajoProfe) {
  const ref = doc(db, 'examenes', examId)
  const answerRef = legacyAnswersRef(examId)
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
    transaction.delete(answerRef)
    return estado
  })
}

export async function borrarExamen(examId, legajoProfe) {
  const ref = doc(db, 'examenes', examId)
  const answerRef = legacyAnswersRef(examId)
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('El examen ya no existe.')
    const exam = snapshot.data()
    if (Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para borrar este examen.')
    if (!isExamDeletable(exam)) throw new Error('No se pueden borrar exámenes en curso, finalizados o archivados.')
    transaction.delete(ref)
    transaction.delete(answerRef)
  })
}

export async function archivarExamen(examId, legajoProfe) {
  await archivarExamenes([examId], legajoProfe)
}

export async function archivarExamenes(examIds, legajoProfe) {
  const ids = [...new Set(examIds)].filter((id) => typeof id === 'string' && id.length > 0)
  if (!ids.length) throw new Error('Seleccioná al menos un examen para archivar.')
  if (ids.length > 100) throw new Error('Seleccioná hasta 100 exámenes por operación.')
  const refs = ids.map((id) => doc(db, 'examenes', id))
  return runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)))
    snapshots.forEach((snapshot) => {
      if (!snapshot.exists()) throw new Error('Uno de los exámenes ya no existe.')
      const exam = snapshot.data()
      if (Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para archivar uno de los exámenes.')
      if (!isExamArchivable(exam)) throw new Error('Sólo se pueden archivar exámenes finalizados que no estén archivados.')
    })
    refs.forEach((ref) => transaction.update(ref, { archivado: true }))
    return ids
  })
}

/** Retira exámenes archivados de las vistas sin eliminar sus entregas ni notas. */
export async function moverExamenesAArchivosDefinitivos(examIds, legajoProfe) {
  const ids = [...new Set(examIds)].filter((id) => typeof id === 'string' && id.length > 0)
  if (!ids.length) throw new Error('Seleccioná al menos un examen archivado.')
  if (ids.length > 100) throw new Error('Seleccioná hasta 100 exámenes por operación.')
  const attemptsByExam = await Promise.all(ids.map(async (id) => {
    const snapshot = await getDocs(query(collection(db, 'examenesEntregados'), where('examenId', '==', id)))
    return snapshot.docs
  }))

  return runTransaction(db, async (transaction) => {
    const sourceRefs = ids.map((id) => doc(db, 'examenes', id))
    const destinationRefs = ids.map((id) => doc(db, 'archivosDefinitivos', id))
    const [sources, destinations, attempts] = await Promise.all([
      Promise.all(sourceRefs.map((ref) => transaction.get(ref))),
      Promise.all(destinationRefs.map((ref) => transaction.get(ref))),
      Promise.all(attemptsByExam.flat().map((item) => transaction.get(item.ref))),
    ])

    sources.forEach((snapshot, index) => {
      const exam = snapshot.data()
      if (!exam || Number(exam.legajoProfe) !== Number(legajoProfe) || exam.archivado !== true ||
        !['finalizado', 'para_corregir', 'cerrado'].includes(getEffectiveExamStatus(exam))) {
        throw new Error('Uno de los exámenes ya no está archivado o no pertenece al profesor.')
      }
      if (destinations[index].exists()) throw new Error('Uno de los exámenes ya existe en archivos definitivos.')
    })
    if (attempts.some((snapshot) => !snapshot.exists() || snapshot.data().estadoEntrega !== 'entregado' || snapshot.data().estadoCorreccion !== 'corregido')) {
      throw new Error('No se pueden retirar exámenes con intentos abiertos o entregas pendientes de corrección.')
    }

    sources.forEach((snapshot, index) => {
      transaction.set(destinationRefs[index], {
        ...snapshot.data(),
        archivoDefinitivo: true,
        fechaArchivoDefinitivo: serverTimestamp(),
      })
      transaction.delete(sourceRefs[index])
    })
    return ids
  })
}

export const dateAndTimeToTimestamp = (date, time) => Timestamp.fromDate(new Date(`${date}T${time}`))
