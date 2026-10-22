export function normalizeCorrection(questions = [], entries = [], requireComplete = false) {
  const byId = new Map(entries.map((entry) => [Number(entry.idPregunta), entry]))
  if (byId.size !== entries.length || entries.some((entry) => !questions.some((question) => Number(question.idPregunta) === Number(entry.idPregunta)))) {
    throw new Error('La corrección contiene preguntas que no pertenecen a esta entrega.')
  }

  return questions.map((question) => {
    const entry = byId.get(Number(question.idPregunta))
    const rawScore = entry?.puntaje
    const score = rawScore === '' || rawScore === null || rawScore === undefined ? null : Number(rawScore)
    const maximum = Number(question.puntajeMaximo)
    if (!Number.isFinite(maximum) || maximum < 0 || (score !== null && (!Number.isFinite(score) || score < 0 || score > maximum))) {
      throw new Error(`El puntaje de la pregunta ${question.idPregunta} debe estar entre 0 y ${maximum}.`)
    }
    if (requireComplete && score === null) throw new Error('Todas las preguntas deben tener puntaje, aunque sea 0.')
    return {
      idPregunta: Number(question.idPregunta),
      puntaje: score,
      comentario: String(entry?.comentario ?? ''),
    }
  })
}

export const correctionTotal = (entries) => entries.reduce((sum, entry) => sum + Number(entry.puntaje ?? 0), 0)
export const correctionTone = (total) => total < 4 ? 'low' : total < 8 ? 'middle' : 'high'
