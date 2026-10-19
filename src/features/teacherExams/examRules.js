import { getEffectiveExamStatus, getExamSchedule, isExamEditable } from '../../utils/examWindow'

export const isValidQuestionScore = (value) =>
  (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) &&
  Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 10

export function assertValidQuestionScores(temas) {
  if ((temas ?? []).some((tema) => (tema.preguntas ?? []).some((pregunta) => !isValidQuestionScore(pregunta.puntaje)))) {
    throw new Error('Cada pregunta debe tener un puntaje entero entre 1 y 10.')
  }
}

export function hasTenPointsPerTopic(temas) {
  return Array.isArray(temas) && temas.length > 0 && temas.every((tema) =>
    Array.isArray(tema.preguntas) && tema.preguntas.length > 0 &&
    tema.preguntas.every((pregunta) => isValidQuestionScore(pregunta.puntaje)) &&
    tema.preguntas.reduce((total, pregunta) => total + Number(pregunta.puntaje), 0) === 10)
}

export function assertExamCanPublish(exam, now = Date.now()) {
  const start = getExamSchedule(exam)?.startMs
  if (!Number.isFinite(start) || start <= now) throw new Error('La fecha y hora deben ser futuras.')
  assertValidQuestionScores(exam.temas)
  if (!hasTenPointsPerTopic(exam.temas)) throw new Error('La sumatoria de puntaje de las preguntas debe ser igual a 10.')
}

export const isExamDeletable = (exam, now = Date.now()) => isExamEditable(exam, now) && !exam?.archivado
export const isExamArchivable = (exam, now = Date.now()) => getEffectiveExamStatus(exam, now) === 'finalizado' && !exam?.archivado
