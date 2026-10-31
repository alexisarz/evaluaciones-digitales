import { getExamSchedule } from '../../utils/examWindow'
import { sortNewestFirst } from '../../shared/sortByCreation'

export function participantDeliveryStatus(exam, attempt, now = Date.now()) {
  if (attempt?.motivoEntrega === 'ausente') return 'Ausente'
  if (attempt?.estadoEntrega === 'entregado') return 'Entregado'
  if (attempt?.estadoEntrega === 'en_curso') return 'En curso'
  if (exam?.estado === 'borrador') return '—'
  const schedule = getExamSchedule(exam)
  return schedule && now >= schedule.deadlineMs ? 'Ausente' : '—'
}

export function buildExamParticipants(exam, students, attempts, now = Date.now()) {
  const byStudent = new Map(attempts.map((attempt) => [Number(attempt.legajoAlumno), attempt]))
  return sortNewestFirst(students).map((student) => {
    const legajo = Number(student.legajo ?? student.id)
    const attempt = byStudent.get(legajo) ?? null
    return {
      legajo,
      nombreCompleto: `${student.nombre ?? ''} ${student.apellido ?? ''}`.trim(),
      attempt,
      estadoEntrega: participantDeliveryStatus(exam, attempt, now),
    }
  })
}

const normalize = (value) => String(value ?? '').toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function filterExamParticipants(rows, search, status = 'todos') {
  const needle = normalize(search.trim())
  return rows.filter((row) => (status === 'todos' || row.estadoEntrega === status) &&
    (!needle || normalize(`${row.nombreCompleto} ${row.legajo} ${row.estadoEntrega}`).includes(needle)))
}

export function blankQuestionsForTopic(topic) {
  const preguntas = (topic?.preguntas ?? []).map((item) => ({
    idPregunta: Number(item.idPregunta), consigna: item.consigna ?? '',
    tipo: item.tipo ?? 'Texto', puntajeMaximo: Number(item.puntaje ?? 0), respuestaTexto: '',
  }))
  return {
    preguntas,
    respuestas: preguntas.map((item) => ({ idPregunta: item.idPregunta, tipo: item.tipo, respuestaTexto: '' })),
  }
}
