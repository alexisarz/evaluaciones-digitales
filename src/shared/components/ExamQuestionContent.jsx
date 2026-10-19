const TYPES = ['Texto', 'Tabla de decisión', 'Árbol de decisión', 'Prueba unitaria']

export default function ExamQuestionContent({ question, answer, onAnswerChange, disabled = false, inputId = 'exam-answer' }) {
  const activeType = question?.tipo === 'Test unitario' ? 'Prueba unitaria' : question?.tipo === 'Árbol' ? 'Árbol de decisión' : question?.tipo
  return <>
    <h1>{question.consigna}</h1>
    <div className="question-type-tabs" role="tablist" aria-label="Tipo de pregunta">
      {TYPES.map((type) => <span key={type} role="tab" aria-selected={activeType === type} className={activeType === type ? 'active' : ''}>{type}</span>)}
    </div>
    <label className="answer-label" htmlFor={inputId}>Tu respuesta</label>
    <textarea id={inputId} className="exam-answer" value={answer} onChange={onAnswerChange} disabled={disabled} placeholder="Escribí tu respuesta aquí…" />
  </>
}
