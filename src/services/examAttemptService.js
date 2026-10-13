import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { examWindowMessage, getEffectiveExamStatus, getExamSchedule, getExamWindowStatus } from '../utils/examWindow'

export const attemptIdFor = (examId, legajo) => `${examId}_${Number(legajo)}`
const attemptRef = (examId, legajo) => doc(db, 'examenesEntregados', attemptIdFor(examId, legajo))

export function clampDraftToExamEnd(draft, attempt) {
  const savedEndMs = attempt?.fechaFinExamen?.toMillis?.() ?? attempt?.fechaFinExamenMs
  const schedule = getExamSchedule({
    fechaInicio: attempt?.fechaInicioProgramada ?? (attempt?.fechaInicioProgramadaMs ? new Date(attempt.fechaInicioProgramadaMs) : null),
    duracionMinutos: attempt?.duracionMinutos,
  })
  const endMs = Number.isFinite(savedEndMs) ? savedEndMs : schedule?.endMs
  if (!Number.isFinite(endMs)) return draft
  return {
    ...draft,
    fechaLimiteMs: Math.min(Number(draft.fechaLimiteMs ?? endMs), endMs),
    fechaFinExamenMs: endMs,
    fechaInicioProgramadaMs: schedule?.startMs ?? draft.fechaInicioProgramadaMs,
  }
}

export function attemptToDraft(attempt) {
  return clampDraftToExamEnd({
    id: attempt.id,
    examenId: attempt.examenId,
    legajoAlumno: Number(attempt.legajoAlumno),
    uidAlumno: attempt.uidAlumno ?? '',
    nombreAlumno: attempt.nombreAlumno,
    apellidoAlumno: attempt.apellidoAlumno,
    nombreExamen: attempt.nombreExamen,
    materia: attempt.materia,
    cursoCodigo: attempt.cursoCodigo,
    comisionId: attempt.comisionId,
    legajoProfe: attempt.legajoProfe,
    tema: attempt.tema,
    preguntas: attempt.preguntas ?? [],
    respuestas: attempt.respuestas ?? [],
    incidentes: attempt.incidentes ?? [],
    fechaInicioAlumnoMs: attempt.fechaInicioAlumno?.toMillis?.() ?? attempt.fechaInicioAlumnoMs,
    fechaLimiteMs: attempt.fechaLimite?.toMillis?.() ?? attempt.fechaLimiteMs,
    estadoEntrega: attempt.estadoEntrega,
    estadoCorreccion: attempt.estadoCorreccion ?? 'pendiente',
    ultimaEdicionMs: attempt.ultimaEdicionMs ?? Date.now(),
  }, attempt)
}

export async function comenzarORecuperarExamen(exam, selectedTopic, profile) {
  const legajo = Number(profile.legajo)
  const ref = attemptRef(exam.id, legajo)
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists()) return { id: existing.id, ...existing.data() }

    const userSnapshot = await transaction.get(doc(db, 'users', String(legajo)))
    const examSnapshot = await transaction.get(doc(db, 'examenes', exam.id))
    const user = userSnapshot.data()
    const currentExam = examSnapshot.data()
    if (!user || user.activo !== true || user.rol !== 'alumno' || !currentExam ||
      !user.cursosActivos?.includes(currentExam.cursoCodigo)) {
      throw new Error('No tenés acceso a este examen.')
    }
    const now = Date.now()
    const examWindow = getExamWindowStatus(currentExam, now)
    if (examWindow.status !== 'open') throw new Error(examWindowMessage(examWindow))
    if (getEffectiveExamStatus(currentExam, now) !== 'en_curso') throw new Error('Este examen no está habilitado para rendir.')
    const topic = currentExam.temas?.find((item) => item.nombreTema === selectedTopic.nombreTema)
    if (!topic) throw new Error('El tema seleccionado ya no está disponible.')
    const schedule = getExamSchedule(currentExam)

    const questions = (topic.preguntas ?? []).map((item) => ({
      idPregunta: Number(item.idPregunta),
      consigna: item.consigna ?? '',
      tipo: item.tipo ?? 'Texto',
      puntajeMaximo: Number(item.puntaje ?? 0),
      respuestaTexto: '',
    }))
    const attempt = {
      examenId: exam.id,
      legajoAlumno: legajo,
      uidAlumno: profile.uid ?? '',
      nombreAlumno: user.nombre ?? profile.nombre ?? '',
      apellidoAlumno: user.apellido ?? profile.apellido ?? '',
      nombreExamen: currentExam.nombre ?? '',
      materia: currentExam.materia ?? '',
      cursoCodigo: currentExam.cursoCodigo,
      comisionId: currentExam.comisionId ?? '',
      legajoProfe: Number(currentExam.legajoProfe),
      tema: { nombreTema: topic.nombreTema, color: topic.color ?? '#244a87' },
      preguntas: questions,
      respuestas: questions.map(({ idPregunta, tipo, respuestaTexto }) => ({ idPregunta, tipo, respuestaTexto })),
      fechaInicioProgramada: currentExam.fechaInicio ?? null,
      fechaFinExamen: Timestamp.fromMillis(schedule.endMs),
      fechaInicioAlumno: Timestamp.fromMillis(now),
      fechaLimite: Timestamp.fromMillis(schedule.endMs),
      fechaEntrega: null,
      duracionMinutos: schedule.durationMinutes,
      tiempoUtilizadoSegundos: null,
      estadoEntrega: 'en_curso',
      estadoCorreccion: 'pendiente',
      incidentes: [],
      nota: null,
      ultimaEdicionMs: now,
      ultimaActualizacion: serverTimestamp(),
    }
    transaction.set(ref, attempt)
    return { id: ref.id, ...attempt }
  })
}

export async function obtenerIntento(examId, legajo) {
  const snapshot = await getDoc(attemptRef(examId, legajo))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export async function obtenerIntentosAlumno(legajo) {
  const snapshot = await getDocs(query(collection(db, 'examenesEntregados'), where('legajoAlumno', '==', Number(legajo))))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function guardarProgresoRemoto(examId, legajo, respuestas, incidentes, ultimaEdicionMs) {
  return runTransaction(db, async (transaction) => {
    const ref = attemptRef(examId, legajo)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists() || snapshot.data().estadoEntrega !== 'en_curso') return
    const schedule = getExamSchedule({
      fechaInicio: snapshot.data().fechaInicioProgramada,
      duracionMinutos: snapshot.data().duracionMinutos,
    })
    if (schedule && Date.now() >= schedule.endMs) return
    transaction.update(ref, {
      respuestas,
      ...(incidentes.length ? { incidentes: arrayUnion(...incidentes) } : {}),
      ultimaEdicionMs,
      ultimaActualizacion: serverTimestamp(),
    })
  })
}

export async function registrarIncidente(examId, legajo, incidente) {
  return updateDoc(attemptRef(examId, legajo), { incidentes: arrayUnion(incidente) })
}

export async function entregarExamen(attempt, draft, motivo = 'manual') {
  const now = draft.fechaEntregaMs ?? Date.now()
  const startedAt = attempt.fechaInicioAlumno?.toMillis?.() ?? draft.fechaInicioAlumnoMs
  const ref = attemptRef(attempt.examenId, attempt.legajoAlumno)
  const delivery = {
    examenId: attempt.examenId,
    legajoAlumno: Number(attempt.legajoAlumno),
    uidAlumno: draft.uidAlumno ?? attempt.uidAlumno ?? '',
    nombreAlumno: draft.nombreAlumno,
    apellidoAlumno: draft.apellidoAlumno,
    nombreExamen: draft.nombreExamen,
    materia: draft.materia,
    cursoCodigo: draft.cursoCodigo,
    comisionId: draft.comisionId,
    legajoProfe: Number(draft.legajoProfe),
    tema: draft.tema,
    preguntas: draft.preguntas,
    fechaInicioAlumno: Timestamp.fromMillis(startedAt),
    fechaLimite: Timestamp.fromMillis(draft.fechaLimiteMs),
    fechaFinExamen: Timestamp.fromMillis(draft.fechaFinExamenMs ?? draft.fechaLimiteMs),
    fechaInicioProgramada: draft.fechaInicioProgramadaMs ? Timestamp.fromMillis(draft.fechaInicioProgramadaMs) : attempt.fechaInicioProgramada ?? null,
    duracionMinutos: Number(attempt.duracionMinutos ?? 120),
    respuestas: draft.respuestas,
    incidentes: draft.incidentes,
    fechaEntrega: Timestamp.fromMillis(now),
    tiempoUtilizadoSegundos: Math.min(7200, Math.max(0, Math.round((now - startedAt) / 1000))),
    estadoEntrega: 'entregado',
    estadoCorreccion: 'pendiente',
    nota: null,
    finalizacion: 'exitosa',
    motivoEntrega: motivo,
    ultimaEdicionMs: draft.ultimaEdicionMs,
    ultimaActualizacion: serverTimestamp(),
  }
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists() || Number(snapshot.data().legajoAlumno) !== Number(attempt.legajoAlumno)) {
      throw new Error('No existe un intento válido para entregar.')
    }
    if (snapshot.data().estadoEntrega === 'entregado') return snapshot.data()
    transaction.update(ref, delivery)
    return delivery
  })
}
