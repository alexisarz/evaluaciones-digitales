import QuestionResponse from './QuestionResponse'

export default function CorrectionQuestionReview({ question, answer, correction, index, total }) {
  return <section className="form-section correction-question student-correction-question">
    <div className="correction-question-heading"><span>Pregunta {index + 1} de {total}</span><span>{question.tipo} · máximo {question.puntajeMaximo} pts</span></div>
    <h2>{question.consigna}</h2>
    <div className="correction-answer"><strong>Tu respuesta</strong><QuestionResponse type={question.tipo} value={answer?.respuestaEstructurada ?? answer?.respuestaTexto} /></div>
    <div className="student-correction-feedback">
      <p><strong>Puntaje:</strong> {correction?.puntaje ?? '—'} / {question.puntajeMaximo}</p>
      <div><strong>Comentarios de corrección</strong><p>{correction?.comentario?.trim() || 'Sin comentarios de corrección.'}</p></div>
    </div>
  </section>
}
