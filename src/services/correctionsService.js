import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import { getEffectiveExamStatus } from '../utils/examWindow'
import { correctionTotal, normalizeCorrection } from '../features/corrections/correctionRules'

const assertTeacherExam = (exam, legajoProfe) => {
  if (!exam || Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para corregir este examen.')
  if (getEffectiveExamStatus(exam) !== 'finalizado') throw new Error('El examen todavía no está finalizado.')
}

const assertAssignedCourse = (course, legajoProfe) => {
  if (!course || Number(course.legajoProfe) !== Number(legajoProfe)) throw new Error('No estás asignado al curso de este examen.')
}

const assertDelivery = (delivery, examId, legajoProfe) => {
  if (!delivery || delivery.examenId !== examId || Number(delivery.legajoProfe) !== Number(legajoProfe) || delivery.estadoEntrega !== 'entregado') {
    throw new Error('Esta entrega no está disponible para corrección.')
  }
}

export async function obtenerEntregasParaCorreccion(examId, legajoProfe) {
  const examSnapshot = await getDoc(doc(db, 'examenes', examId))
  const exam = examSnapshot.data()
  assertTeacherExam(exam, legajoProfe)
  const courseSnapshot = await getDoc(doc(db, 'cursos', exam.cursoCodigo))
  assertAssignedCourse(courseSnapshot.data(), legajoProfe)
  const snapshot = await getDocs(query(collection(db, 'examenesEntregados'), where('examenId', '==', examId)))
  const deliveries = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.estadoEntrega === 'entregado' && Number(item.legajoProfe) === Number(legajoProfe))
    .sort((a, b) => Number(a.legajoAlumno) - Number(b.legajoAlumno))
  return { exam: { id: examId, ...exam }, deliveries }
}

export async function obtenerEntregaParaCorreccion(deliveryId, legajoProfe) {
  const deliverySnapshot = await getDoc(doc(db, 'examenesEntregados', deliveryId))
  if (!deliverySnapshot.exists()) throw new Error('La entrega solicitada no existe.')
  const delivery = { id: deliverySnapshot.id, ...deliverySnapshot.data() }
  const examSnapshot = await getDoc(doc(db, 'examenes', delivery.examenId))
  const exam = examSnapshot.data()
  assertTeacherExam(exam, legajoProfe)
  const courseSnapshot = await getDoc(doc(db, 'cursos', exam.cursoCodigo))
  assertAssignedCourse(courseSnapshot.data(), legajoProfe)
  assertDelivery(delivery, delivery.examenId, legajoProfe)
  return { exam: { id: delivery.examenId, ...exam }, delivery }
}

async function guardarCorreccion(deliveryId, legajoProfe, entries, finalizar) {
  const deliveryRef = doc(db, 'examenesEntregados', deliveryId)
  return runTransaction(db, async (transaction) => {
    const deliverySnapshot = await transaction.get(deliveryRef)
    if (!deliverySnapshot.exists()) throw new Error('La entrega solicitada no existe.')
    const delivery = deliverySnapshot.data()
    const examSnapshot = await transaction.get(doc(db, 'examenes', delivery.examenId))
    assertTeacherExam(examSnapshot.data(), legajoProfe)
    assertDelivery(delivery, delivery.examenId, legajoProfe)
    const courseSnapshot = await transaction.get(doc(db, 'cursos', examSnapshot.data().cursoCodigo))
    assertAssignedCourse(courseSnapshot.data(), legajoProfe)
    if (delivery.estadoCorreccion === 'corregido') throw new Error('Esta entrega ya fue corregida y no se puede modificar.')
    const correction = normalizeCorrection(delivery.preguntas ?? [], entries, finalizar)
    const changes = {
      correccion: correction,
      correccionIniciada: true,
      legajoCorrector: Number(legajoProfe),
      ultimaCorreccion: serverTimestamp(),
      ...(finalizar ? {
        estadoCorreccion: 'corregido',
        nota: correctionTotal(correction),
        notaPublicada: true,
        fechaCorreccion: serverTimestamp(),
        fechaPublicacionNota: serverTimestamp(),
      } : { estadoCorreccion: 'pendiente' }),
    }
    transaction.update(deliveryRef, changes)
    return { id: deliveryId, ...delivery, ...changes, ultimaCorreccion: new Date(), ...(finalizar ? { fechaCorreccion: new Date(), fechaPublicacionNota: new Date() } : {}) }
  })
}

export const guardarBorradorCorreccion = (deliveryId, legajoProfe, entries) => guardarCorreccion(deliveryId, legajoProfe, entries, false)
export const finalizarCorreccion = (deliveryId, legajoProfe, entries) => guardarCorreccion(deliveryId, legajoProfe, entries, true)
