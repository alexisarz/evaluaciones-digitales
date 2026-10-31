import { Timestamp, collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import { attemptIdFor } from './examAttemptService'
import { getEffectiveExamStatus, getExamSchedule } from '../utils/examWindow'
import { blankQuestionsForTopic } from '../features/teacherExams/examParticipantsRules'
import { activeStudentsFromSnapshot } from '../shared/activeEnrollment'

const attemptsCollection = collection(db, 'examenesEntregados')

export async function obtenerParticipantesExamen(examId, legajoProfe) {
  const examSnapshot = await getDoc(doc(db, 'examenes', examId))
  if (!examSnapshot.exists()) throw new Error('El examen solicitado no existe.')
  const exam = { id: examSnapshot.id, ...examSnapshot.data() }
  if (Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés acceso a este examen.')
  const courseSnapshot = await getDoc(doc(db, 'cursos', exam.cursoCodigo))
  if (!courseSnapshot.exists() || Number(courseSnapshot.data().legajoProfe) !== Number(legajoProfe)) {
    throw new Error('No estás asignado al curso de este examen.')
  }
  const studentsSnapshot = await getDocs(query(collection(db, 'users'), where('cursosActivos', 'array-contains', exam.cursoCodigo)))
  const students = activeStudentsFromSnapshot(studentsSnapshot)
  return { exam, students }
}

export function escucharIntentosExamen(examId, onAttempts, onError) {
  const attemptsQuery = query(attemptsCollection, where('examenId', '==', examId))
  return onSnapshot(attemptsQuery, (snapshot) => {
    onAttempts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function escucharEstadoExamen(examId, onExam, onError) {
  return onSnapshot(doc(db, 'examenes', examId), (snapshot) => {
    if (snapshot.exists()) onExam({ id: snapshot.id, ...snapshot.data() })
  }, onError)
}

async function entregarIntentoPorFinalizacion(ref, examId, legajoProfe, endedAtMs) {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) return
    const attempt = snapshot.data()
    if (attempt.examenId !== examId || Number(attempt.legajoProfe) !== Number(legajoProfe)) {
      throw new Error('Hay un intento que no pertenece a este examen.')
    }
    if (attempt.estadoEntrega !== 'en_curso') return
    const startedAtMs = attempt.fechaInicioAlumno?.toMillis?.() ?? endedAtMs
    transaction.update(ref, {
      estadoEntrega: 'entregado', estadoCorreccion: 'pendiente',
      motivoEntrega: 'finalizacion_profesor', finalizacion: 'exitosa',
      fechaEntrega: Timestamp.fromMillis(endedAtMs),
      fechaLimite: Timestamp.fromMillis(endedAtMs),
      fechaFinExamen: Timestamp.fromMillis(endedAtMs),
      tiempoUtilizadoSegundos: Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000)),
      ultimaActualizacion: serverTimestamp(),
    })
  })
}

/** Cierra la ventana primero para impedir nuevos CLOCK IN; después entrega los intentos abiertos. */
export async function finalizarExamenAnticipadamente(examId, legajoProfe) {
  const examRef = doc(db, 'examenes', examId)
  const endedAtMs = await runTransaction(db, async (transaction) => {
    const examSnapshot = await transaction.get(examRef)
    if (!examSnapshot.exists()) throw new Error('El examen ya no existe.')
    const exam = examSnapshot.data()
    if (Number(exam.legajoProfe) !== Number(legajoProfe)) throw new Error('No tenés permiso para finalizar este examen.')
    const courseSnapshot = await transaction.get(doc(db, 'cursos', exam.cursoCodigo))
    if (!courseSnapshot.exists() || Number(courseSnapshot.data().legajoProfe) !== Number(legajoProfe)) {
      throw new Error('No estás asignado al curso de este examen.')
    }
    if (exam.fechaFinForzada) {
      const recordedEnd = exam.fechaFinForzada.toMillis?.() ?? Date.parse(exam.fechaFinForzada)
      if (Number.isFinite(recordedEnd)) return recordedEnd
    }
    if (getEffectiveExamStatus(exam) !== 'en_curso') throw new Error('Solo se puede finalizar anticipadamente un examen en curso.')
    const now = Date.now()
    transaction.update(examRef, {
      estado: 'finalizado', fechaFinForzada: Timestamp.fromMillis(now),
      fechaFinalizacionForzada: serverTimestamp(), legajoFinalizador: Number(legajoProfe),
    })
    return now
  })

  const attemptsQuery = query(attemptsCollection, where('examenId', '==', examId))
  for (let pass = 0; pass < 3; pass += 1) {
    const snapshot = await getDocs(attemptsQuery)
    const pending = snapshot.docs.filter((item) => item.data().estadoEntrega === 'en_curso')
    if (!pending.length) break
    for (let index = 0; index < pending.length; index += 20) {
      await Promise.allSettled(pending.slice(index, index + 20)
        .map((item) => entregarIntentoPorFinalizacion(item.ref, examId, legajoProfe, endedAtMs)))
    }
  }
  const finalSnapshot = await getDocs(attemptsQuery)
  const remaining = finalSnapshot.docs.filter((item) => item.data().estadoEntrega === 'en_curso').length
  if (remaining) throw new Error(`El examen quedó cerrado, pero faltan ${remaining} entrega${remaining === 1 ? '' : 's'}. Reintentá la finalización desde este panel.`)
  return { examId, fechaFinForzada: Timestamp.fromMillis(endedAtMs) }
}

/** Crea una entrega vacía una sola vez, cuando el alumno nunca hizo CLOCK IN. */
export async function crearEntregaAusente(examId, legajoAlumno, nombreTema, legajoProfe) {
  const legajo = Number(legajoAlumno)
  const ref = doc(db, 'examenesEntregados', attemptIdFor(examId, legajo))
  return runTransaction(db, async (transaction) => {
    const [examSnapshot, studentSnapshot, attemptSnapshot] = await Promise.all([
      transaction.get(doc(db, 'examenes', examId)),
      transaction.get(doc(db, 'users', String(legajo))),
      transaction.get(ref),
    ])
    const exam = examSnapshot.data()
    const student = studentSnapshot.data()
    const schedule = getExamSchedule(exam)
    if (!exam || Number(exam.legajoProfe) !== Number(legajoProfe) || getEffectiveExamStatus(exam) !== 'finalizado' ||
      !schedule || Date.now() < schedule.endMs) {
      throw new Error('Este examen no está finalizado o no te pertenece.')
    }
    const courseRef = doc(db, 'cursos', exam.cursoCodigo)
    const ownedCourse = await transaction.get(courseRef)
    if (!ownedCourse.exists() || Number(ownedCourse.data().legajoProfe) !== Number(legajoProfe)) {
      throw new Error('No estás asignado al curso de este examen.')
    }
    if (!student || student.rol !== 'alumno' || student.activo !== true || !student.cursosActivos?.includes(exam.cursoCodigo)) {
      throw new Error('El alumno ya no está inscripto en este curso.')
    }
    if (attemptSnapshot.exists()) throw new Error('Este alumno ya tiene un intento o una entrega. Actualizá el listado.')
    const topic = exam.temas?.find((item) => item.nombreTema === nombreTema)
    if (!topic) throw new Error('Seleccioná un tema válido para el examen en blanco.')
    const { preguntas, respuestas } = blankQuestionsForTopic(topic)
    const delivery = {
      examenId: examId, legajoAlumno: legajo, uidAlumno: '',
      nombreAlumno: student.nombre ?? '', apellidoAlumno: student.apellido ?? '',
      nombreExamen: exam.nombre ?? '', materia: exam.materia ?? '',
      cursoCodigo: exam.cursoCodigo, comisionId: exam.comisionId ?? '',
      legajoProfe: Number(legajoProfe),
      tema: { nombreTema: topic.nombreTema, color: topic.color ?? '#244a87' },
      preguntas, respuestas,
      fechaInicioProgramada: exam.fechaInicio ?? null,
      fechaFinExamen: Timestamp.fromMillis(schedule.endMs),
      fechaInicioAlumno: null, fechaLimite: Timestamp.fromMillis(schedule.endMs),
      fechaEntrega: Timestamp.fromMillis(schedule.endMs), fechaRegistroAusencia: Timestamp.now(),
      fechaCreacion: Timestamp.now(),
      duracionMinutos: Number(exam.duracionMinutos ?? 120),
      tiempoUtilizadoSegundos: 0, estadoEntrega: 'entregado', estadoCorreccion: 'pendiente',
      incidentes: [], nota: null, notaPublicada: false,
      motivoEntrega: 'ausente', finalizacion: 'ausencia',
      ultimaEdicionMs: Date.now(), ultimaActualizacion: serverTimestamp(),
    }
    transaction.set(ref, delivery)
    return { id: ref.id, ...delivery }
  })
}
