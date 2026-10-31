/** No incluye la clave de respuesta en los datos derivados para las vistas del alumno. */
export function withoutExpectedAnswers(temas = []) {
  return temas.map((tema) => ({
    ...tema,
    preguntas: (tema.preguntas ?? []).map((question) => {
      const publicQuestion = { ...question }
      delete publicQuestion.respuestaEsperada
      return publicQuestion
    }),
  }))
}

export function expectedAnswerFor(answerTemas = [], nombreTema, idPregunta) {
  return answerTemas.find((tema) => tema.nombreTema === nombreTema)?.preguntas
    ?.find((question) => Number(question.idPregunta) === Number(idPregunta))?.respuestaEsperada ?? ''
}

export function mergeExpectedAnswers(temas = [], answerTemas = []) {
  return temas.map((tema) => ({
    ...tema,
    preguntas: (tema.preguntas ?? []).map((question) => ({
      ...question,
      respuestaEsperada: question.respuestaEsperada ?? expectedAnswerFor(answerTemas, tema.nombreTema, question.idPregunta),
    })),
  }))
}
