import Field from '../../shared/components/Field'
import StructuredAnswer from '../../shared/components/StructuredAnswer'

export default function ExamQuestionEditor({ question, onChange, onScoreChange, onSave, editing, onCancel }) {
  const change = (field, value) => onChange((current) => ({ ...current, [field]: value }))

  return <div className="question-builder">
    <Field label="Consigna"><input value={question.consigna} onChange={(event) => change('consigna', event.target.value)} placeholder="Escribí la consigna" /></Field>
    <div className="expected-answer-field"><Field label="Respuesta esperada (solo para el profesor)">
      {question.tipo === 'Tabla de decisión' || question.tipo === 'Árbol de decisión'
        ? <StructuredAnswer type={question.tipo} value={question.respuestaEsperada} onChange={(value) => change('respuestaEsperada', value)} />
        : <textarea value={typeof question.respuestaEsperada === 'string' ? question.respuestaEsperada : ''} onChange={(event) => change('respuestaEsperada', event.target.value)} placeholder="Escribí la respuesta esperada para cotejar durante la corrección" />}
    </Field></div>
    <Field label="Tipo de pregunta"><select value={question.tipo} onChange={(event) => onChange((current) => ({ ...current, tipo: event.target.value, respuestaEsperada: '' }))}><option>Texto</option><option>Tabla de decisión</option><option>Árbol de decisión</option><option>Prueba unitaria</option></select></Field>
    <Field label="Puntaje"><input type="number" min="1" max="10" step="1" value={question.puntaje} onChange={(event) => onScoreChange(event.target.value)} /></Field>
    <button type="button" className="secondary-action" onClick={onSave}>{editing ? 'Guardar pregunta' : '+ Agregar pregunta'}</button>
    {editing && <button type="button" className="secondary-action" onClick={onCancel}>Cancelar edición</button>}
  </div>
}
