import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../context/AuthContext'
import { actualizarExamen, crearExamen as guardarExamen, dateAndTimeToTimestamp, obtenerExamenPorId } from '../services/examsService'
import { obtenerCursosPorProfesor } from '../services/coursesService'
import { isExamEditable } from '../utils/examWindow'

const topicColors = ['#1d4ed8', '#0f766e', '#9333ea', '#c2410c', '#be123c', '#0369a1']
const initialTopic = { nombreTema: 'Tema A', color: topicColors[0], preguntas: [] }
const emptyQuestion = { consigna: '', tipo: 'Texto', puntaje: '1' }
const blankForm = { nombre: '', cursoCodigo: '', materia: '', fecha: '', hora: '19:00', duracionMinutos: 120, toleranciaMinutos: '15', tipoAsignacion: 'Automático (alternado por legajo)', temas: [initialTopic], estado: 'borrador' }
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
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [originalExam, setOriginalExam] = useState(null)
  const [now, setNow] = useState(Date.now())
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const changeCourse = (event) => {
    const course = courses.find((item) => (item.idCurso ?? item.id) === event.target.value)
    setForm((current) => ({ ...current, cursoCodigo: event.target.value, materia: course?.materia ?? '', comisionId: course?.comisiones?.[0] ?? '' }))
  }

  useEffect(() => {
    if (!examId) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [examId])

  useEffect(() => {
    let mounted = true
    obtenerCursosPorProfesor(user.legajo).then((data) => {
      if (!mounted) return
      setCourses(data)
      if (!examId && data.length === 1) setForm((current) => ({ ...current, cursoCodigo: data[0].idCurso ?? data[0].id, materia: data[0].materia ?? '', comisionId: data[0].comisiones?.[0] ?? '' }))
    }).catch(() => mounted && setError('No se pudieron cargar tus cursos asignados.')).finally(() => mounted && setLoadingCourses(false))
    return () => { mounted = false }
  }, [examId, user.legajo])

  useEffect(() => {
    if (!examId) return
    let mounted = true
    obtenerExamenPorId(examId).then((exam) => {
      if (!mounted) return
      if (exam.legajoProfe !== Number(user.legajo)) throw new Error('No tenés permiso para editar este examen.')
      if (!isExamEditable(exam)) throw new Error('Este examen ya está en curso o finalizado y no se puede editar.')
      setOriginalExam(exam)
      setForm({ ...blankForm, ...exam, fecha: toDateValue(exam.fechaInicio), hora: toTimeValue(exam.fechaInicio), duracionMinutos: 120, temas: exam.temas?.length ? exam.temas.map((topic, index) => ({ ...topic, color: topic.color ?? topicColors[index % topicColors.length] })) : [] })
    }).catch((loadError) => mounted && setError(loadError.message || 'No se pudo cargar el examen.')).finally(() => mounted && setLoadingExam(false))
    return () => { mounted = false }
  }, [examId, user.legajo])

  const addTopic = () => {
    const nextIndex = form.temas.length
    setForm((current) => ({ ...current, temas: [...current.temas, { nombreTema: `Tema ${String.fromCharCode(65 + current.temas.length)}`, color: topicColors[current.temas.length % topicColors.length], preguntas: [] }] }))
    setActiveTopic(nextIndex)
  }
  const removeActiveTopic = () => {
    if (!currentTopic) return
    setForm((current) => ({ ...current, temas: current.temas.filter((_, index) => index !== activeTopic) }))
    setActiveTopic((current) => Math.max(0, current - 1))
  }
  const changeTopicColor = (color) => setForm((current) => ({ ...current, temas: current.temas.map((topic, index) => index === activeTopic ? { ...topic, color } : topic) }))
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
    const topicColorSet = new Set(form.temas.map((topic) => topic.color))
    if (topicColorSet.size !== form.temas.length) return setError('Cada tema debe tener un color diferente.')
    setSaving(true); setError('')
    try {
      const datosExamen = { nombre: form.nombre.trim(), cursoCodigo: form.cursoCodigo, comisionId: form.comisionId ?? '', materia: form.materia.trim(), legajoProfe: Number(user.legajo), fechaInicio: dateAndTimeToTimestamp(form.fecha, form.hora), duracionMinutos: 120, toleranciaMinutos: Number(form.toleranciaMinutos), estado, tipoAsignacion: form.tipoAsignacion, temas: form.temas }
      if (examId) await actualizarExamen(examId, datosExamen, user.legajo)
      else await crearExamen(datosExamen)
      navigate('/profesor/misExamenes')
    } catch (saveError) { setError(saveError.message || 'No se pudo guardar el examen.') } finally { setSaving(false) }
  }
  const currentTopic = form.temas[activeTopic]
  const total = currentTopic?.preguntas.reduce((sum, item) => sum + item.puntaje, 0) ?? 0

  if (loadingExam) return <TeacherShell><p className="table-message">Cargando examen…</p></TeacherShell>
  if (examId && error) return <TeacherShell><p className="error table-message">{error}</p><Link to="/profesor/misExamenes">← Volver a mis exámenes</Link></TeacherShell>
  if (examId && originalExam && !isExamEditable(originalExam, now)) return <TeacherShell><p className="error table-message">Este examen ya está en curso o finalizado y no se puede editar.</p><Link to="/profesor/misExamenes">← Volver a mis exámenes</Link></TeacherShell>

  return <TeacherShell><section className="new-exam-header"><div><Link to="/profesor/misExamenes">← Mis exámenes</Link><h1>{examId ? 'Editar examen' : 'Nuevo examen'}</h1></div><span className={`status-pill ${form.estado}`}>{({ borrador: 'Borrador', programado: 'Programado', reprogramado: 'Reprogramado' })[form.estado] ?? form.estado}</span></section>
    <form ref={formRef} className="exam-form" onSubmit={(event) => event.preventDefault()}>
      <FormSection title="1 · Datos generales"><div className="form-grid">
        <Field label="Nombre del examen"><input name="nombre" value={form.nombre} onChange={change} required /></Field><Field label="Curso"><select name="cursoCodigo" value={form.cursoCodigo} onChange={changeCourse} required disabled={loadingCourses}><option value="">{loadingCourses ? 'Cargando cursos…' : 'Seleccioná un curso'}</option>{courses.map((course) => <option key={course.id} value={course.idCurso ?? course.id}>{course.idCurso ?? course.id} · {course.materia}</option>)}</select></Field><Field label="Comisión"><select name="comisionId" value={form.comisionId ?? ''} onChange={change} disabled={!form.cursoCodigo}><option value="">Sin comisión</option>{(courses.find((course) => (course.idCurso ?? course.id) === form.cursoCodigo)?.comisiones ?? []).map((commission) => <option key={commission} value={commission}>{commission}</option>)}</select></Field><Field label="Materia"><input name="materia" value={form.materia} readOnly required /></Field><Field label="Fecha"><input type="date" name="fecha" value={form.fecha} onChange={change} required /></Field><Field label="Hora de inicio"><input type="time" name="hora" value={form.hora} onChange={change} required /></Field><Field label="Duración"><input value="120 minutos (fija)" readOnly /></Field><Field label="Tolerancia de ingreso (min)"><input type="number" min="0" name="toleranciaMinutos" value={form.toleranciaMinutos} onChange={change} required /></Field>
      </div></FormSection>
      <FormSection title="2 · Temas y asignación"><div className="topic-tabs">{form.temas.map((topic, index) => <button key={topic.nombreTema} type="button" className={index === activeTopic ? 'active' : ''} style={{ backgroundColor: topic.color, borderColor: topic.color }} aria-pressed={index === activeTopic} onClick={() => setActiveTopic(index)}>{topic.nombreTema}</button>)}<button type="button" className="add-topic" onClick={addTopic}>+ Agregar tema</button>{currentTopic && <button type="button" className="remove-topic" onClick={removeActiveTopic}>Eliminar tema</button>}</div>{currentTopic && <Field label={`Color de ${currentTopic.nombreTema}`}><input className="topic-color" type="color" value={currentTopic.color} onChange={(event) => changeTopicColor(event.target.value)} /></Field>}<Field label="Cómo se asigna el tema a cada alumno"><select name="tipoAsignacion" value={form.tipoAsignacion} onChange={change}><option>Automático (alternado por legajo)</option><option>Manual</option><option>Aleatorio</option></select></Field></FormSection>
      {currentTopic ? <FormSection title={`3 · Preguntas del ${currentTopic.nombreTema}`} aside={`Total: ${total} pts`}><div className="question-list">{currentTopic.preguntas.map((item, index) => <article key={item.idPregunta} className="question-row"><span>{String(index + 1).padStart(2, '0')}</span><p>{item.consigna}</p><em>{item.tipo}</em><strong>{item.puntaje} pts</strong><button type="button" onClick={() => removeQuestion(index)}>Quitar</button></article>)}</div><div className="question-builder"><Field label="Consigna"><input value={question.consigna} onChange={(event) => setQuestion((current) => ({ ...current, consigna: event.target.value }))} placeholder="Escribí la consigna" /></Field><Field label="Tipo de pregunta"><select value={question.tipo} onChange={(event) => setQuestion((current) => ({ ...current, tipo: event.target.value }))}><option>Texto</option><option>Tabla de decisión</option><option>Árbol de decisión</option><option>Prueba unitaria</option></select></Field><Field label="Puntaje"><input type="number" min="1" value={question.puntaje} onChange={(event) => setQuestion((current) => ({ ...current, puntaje: event.target.value }))} /></Field><button type="button" className="secondary-action" onClick={addQuestion}>+ Agregar pregunta</button></div></FormSection> : <p className="empty-topics">No hay temas. Agregá uno para incluir preguntas.</p>}
      {error && <p className="error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-action" disabled>Vista previa como alumno</button>{examId ? <button type="button" className="primary-action button-action" onClick={() => save(form.estado)} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button> : <><button type="button" className="secondary-action" onClick={() => save('borrador')} disabled={saving}>Guardar borrador</button><button type="button" className="primary-action button-action" onClick={() => save('programado')} disabled={saving}>{saving ? 'Guardando…' : 'Publicar examen'}</button></>}</div>
    </form>
  </TeacherShell>
}

function FormSection({ title, aside, children }) { return <section className="form-section"><div className="section-title"><h2>{title}</h2>{aside && <span>{aside}</span>}</div>{children}</section> }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
