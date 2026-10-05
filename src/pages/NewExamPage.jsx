import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../context/AuthContext'
import { actualizarExamen, crearExamen as guardarExamen, dateAndTimeToTimestamp, obtenerExamenPorId } from '../services/examsService'

const initialTopic = { nombreTema: 'Tema A', preguntas: [] }
const emptyQuestion = { consigna: '', tipo: 'Texto', puntaje: '1' }
const blankForm = { nombre: '', materia: '', comisionId: 'Comisión A', fecha: '', hora: '19:00', duracionMinutos: '90', toleranciaMinutos: '15', tipoAsignacion: 'Automático (alternado por legajo)', temas: [initialTopic], estado: 'borrador' }
const toDateValue = (timestamp) => { const value = timestamp?.toDate?.(); if (!value) return ''; return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const toTimeValue = (timestamp) => timestamp?.toDate?.().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) ?? ''

export default function NewExamPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const examId = searchParams.get('id')
  const formRef = useRef(null)
  const [form, setForm] = useState(blankForm)
  const [activeTopic, setActiveTopic] = useState(0)
  const [question, setQuestion] = useState(emptyQuestion)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingExam, setLoadingExam] = useState(Boolean(examId))
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  useEffect(() => {
    if (!examId) return
    let mounted = true
    obtenerExamenPorId(examId).then((exam) => {
      if (!mounted) return
      if (exam.profesorId !== String(user.legajo) || !['borrador', 'programado'].includes(exam.estado)) throw new Error('No tenés permiso para editar este examen.')
      setForm({ ...blankForm, ...exam, fecha: toDateValue(exam.fechaInicio), hora: toTimeValue(exam.fechaInicio), temas: exam.temas?.length ? exam.temas : [] })
    }).catch((loadError) => mounted && setError(loadError.message || 'No se pudo cargar el examen.')).finally(() => mounted && setLoadingExam(false))
    return () => { mounted = false }
  }, [examId, user.legajo])

  const addTopic = () => {
    const nextIndex = form.temas.length
    setForm((current) => ({ ...current, temas: [...current.temas, { nombreTema: `Tema ${String.fromCharCode(65 + current.temas.length)}`, preguntas: [] }] }))
    setActiveTopic(nextIndex)
  }
  const removeActiveTopic = () => {
    if (!currentTopic) return
    setForm((current) => ({ ...current, temas: current.temas.filter((_, index) => index !== activeTopic) }))
    setActiveTopic((current) => Math.max(0, current - 1))
  }
  const addQuestion = () => {
    if (!question.consigna.trim()) return setError('Escribí la consigna antes de agregar la pregunta.')
    setError('')
    setForm((current) => ({ ...current, temas: current.temas.map((topic, index) => index !== activeTopic ? topic : { ...topic, preguntas: [...topic.preguntas, { idPregunta: topic.preguntas.length + 1, consigna: question.consigna.trim(), tipo: question.tipo, puntaje: Number(question.puntaje) }] }) }))
    setQuestion(emptyQuestion)
  }
  const removeQuestion = (removeIndex) => setForm((current) => ({ ...current, temas: current.temas.map((topic, index) => index !== activeTopic ? topic : { ...topic, preguntas: topic.preguntas.filter((_, index) => index !== removeIndex).map((item, index) => ({ ...item, idPregunta: index + 1 })) }) }))

  // Esta función se utiliza para borradores y publicaciones; sólo cambia estado.
  async function crearExamen(datosExamen) { return guardarExamen(datosExamen) }
  const save = async (estado) => {
    if (!formRef.current.reportValidity()) return
    setSaving(true); setError('')
    try {
      const datosExamen = { nombre: form.nombre.trim(), comisionId: form.comisionId, materia: form.materia.trim(), profesorId: String(user.legajo), fechaInicio: dateAndTimeToTimestamp(form.fecha, form.hora), duracionMinutos: Number(form.duracionMinutos), toleranciaMinutos: Number(form.toleranciaMinutos), estado, tipoAsignacion: form.tipoAsignacion, temas: form.temas }
      if (examId) await actualizarExamen(examId, datosExamen)
      else await crearExamen(datosExamen)
      navigate('/profesor/misExamenes')
    } catch (saveError) { setError(saveError.message || 'No se pudo guardar el examen.') } finally { setSaving(false) }
  }
  const currentTopic = form.temas[activeTopic]
  const total = currentTopic?.preguntas.reduce((sum, item) => sum + item.puntaje, 0) ?? 0

  if (loadingExam) return <TeacherShell><p className="table-message">Cargando examen…</p></TeacherShell>
  if (examId && error) return <TeacherShell><p className="error table-message">{error}</p><Link to="/profesor/misExamenes">← Volver a mis exámenes</Link></TeacherShell>

  return <TeacherShell><section className="new-exam-header"><div><Link to="/profesor/misExamenes">← Mis exámenes</Link><h1>{examId ? 'Editar examen' : 'Nuevo examen'}</h1></div><span className={`status-pill ${form.estado}`}>{form.estado === 'programado' ? 'Programado' : 'Borrador'}</span></section>
    <form ref={formRef} className="exam-form" onSubmit={(event) => event.preventDefault()}>
      <FormSection title="1 · Datos generales"><div className="form-grid">
        <Field label="Nombre del examen"><input name="nombre" value={form.nombre} onChange={change} required /></Field><Field label="Comisión"><select name="comisionId" value={form.comisionId} onChange={change}><option>Comisión A</option><option>Comisión B</option></select></Field><Field label="Materia"><input name="materia" placeholder="Ej. Testing de Aplicaciones" value={form.materia} onChange={change} required /></Field><Field label="Fecha"><input type="date" name="fecha" value={form.fecha} onChange={change} required /></Field><Field label="Hora de inicio"><input type="time" name="hora" value={form.hora} onChange={change} required /></Field><Field label="Duración (min)"><input type="number" min="1" name="duracionMinutos" value={form.duracionMinutos} onChange={change} required /></Field><Field label="Tolerancia de ingreso (min)"><input type="number" min="0" name="toleranciaMinutos" value={form.toleranciaMinutos} onChange={change} required /></Field>
      </div></FormSection>
      <FormSection title="2 · Temas y asignación"><div className="topic-tabs">{form.temas.map((topic, index) => <button key={topic.nombreTema} type="button" className={index === activeTopic ? 'active' : ''} onClick={() => setActiveTopic(index)}>{topic.nombreTema}</button>)}<button type="button" className="add-topic" onClick={addTopic}>+ Agregar tema</button>{currentTopic && <button type="button" className="remove-topic" onClick={removeActiveTopic}>Eliminar tema</button>}</div><Field label="Cómo se asigna el tema a cada alumno"><select name="tipoAsignacion" value={form.tipoAsignacion} onChange={change}><option>Automático (alternado por legajo)</option><option>Manual</option><option>Aleatorio</option></select></Field></FormSection>
      {currentTopic ? <FormSection title={`3 · Preguntas del ${currentTopic.nombreTema}`} aside={`Total: ${total} pts`}><div className="question-list">{currentTopic.preguntas.map((item, index) => <article key={item.idPregunta} className="question-row"><span>{String(index + 1).padStart(2, '0')}</span><p>{item.consigna}</p><em>{item.tipo}</em><strong>{item.puntaje} pts</strong><button type="button" onClick={() => removeQuestion(index)}>Quitar</button></article>)}</div><div className="question-builder"><Field label="Consigna"><input value={question.consigna} onChange={(event) => setQuestion((current) => ({ ...current, consigna: event.target.value }))} placeholder="Escribí la consigna" /></Field><Field label="Tipo de pregunta"><select value={question.tipo} onChange={(event) => setQuestion((current) => ({ ...current, tipo: event.target.value }))}><option>Texto</option><option>Tabla de decisión</option><option>Árbol de decisión</option></select></Field><Field label="Puntaje"><input type="number" min="1" value={question.puntaje} onChange={(event) => setQuestion((current) => ({ ...current, puntaje: event.target.value }))} /></Field><button type="button" className="secondary-action" onClick={addQuestion}>+ Agregar pregunta</button></div></FormSection> : <p className="empty-topics">No hay temas. Agregá uno para incluir preguntas.</p>}
      {error && <p className="error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-action" disabled>Vista previa como alumno</button>{examId ? <button type="button" className="primary-action button-action" onClick={() => save(form.estado)} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button> : <><button type="button" className="secondary-action" onClick={() => save('borrador')} disabled={saving}>Guardar borrador</button><button type="button" className="primary-action button-action" onClick={() => save('programado')} disabled={saving}>{saving ? 'Guardando…' : 'Publicar examen'}</button></>}</div>
    </form>
  </TeacherShell>
}

function FormSection({ title, aside, children }) { return <section className="form-section"><div className="section-title"><h2>{title}</h2>{aside && <span>{aside}</span>}</div>{children}</section> }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
