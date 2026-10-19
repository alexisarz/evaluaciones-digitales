import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import FormSection from '../shared/components/FormSection'
import Field from '../shared/components/Field'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import { useAuth } from '../features/auth/useAuth'
import { obtenerExamenPorId } from '../services/examsService'
import { saveTeacherExam } from '../features/teacherExams/teacherExamsSlice'
import { previewCleared, previewOpened, selectExamPreviewDraft } from '../features/teacherExams/examPreviewSlice'
import { hasTenPointsPerTopic, isValidQuestionScore } from '../features/teacherExams/examRules'
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
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const examId = searchParams.get('id')
  const previewDraft = useSelector(selectExamPreviewDraft)
  const [restoredDraft] = useState(() => previewDraft?.originPath === location.pathname + location.search && Number(previewDraft.legajoProfe) === Number(user.legajo) ? previewDraft : null)
  const formRef = useRef(null)
  const [form, setForm] = useState(() => restoredDraft?.form ?? blankForm)
  const [activeTopic, setActiveTopic] = useState(() => restoredDraft?.activeTopic ?? 0)
  const [question, setQuestion] = useState(() => restoredDraft?.question ?? emptyQuestion)
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(() => restoredDraft?.editingQuestionIndex ?? null)
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loadingExam, setLoadingExam] = useState(Boolean(examId))
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [originalExam, setOriginalExam] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const currentTopic = form.temas[activeTopic]
  const total = currentTopic?.preguntas.reduce((sum, item) => sum + Number(item.puntaje), 0) ?? 0
  const hasQuestions = form.temas.some((topic) => topic.preguntas.length > 0)
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const changeQuestionScore = (value) => {
    if (value === '' || /^(?:[1-9]|10)$/.test(value)) setQuestion((current) => ({ ...current, puntaje: value }))
  }
  const resetQuestionEditor = () => { setQuestion(emptyQuestion); setEditingQuestionIndex(null) }

  useEffect(() => {
    if (restoredDraft) dispatch(previewCleared())
  }, [dispatch, restoredDraft])

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
      if (!examId && !restoredDraft && data.length === 1) setForm((current) => ({ ...current, cursoCodigo: data[0].idCurso ?? data[0].id, materia: data[0].materia ?? '', comisionId: data[0].comisiones?.[0] ?? '' }))
    }).catch(() => mounted && setError('No se pudieron cargar tus cursos asignados.')).finally(() => mounted && setLoadingCourses(false))
    return () => { mounted = false }
  }, [examId, restoredDraft, user.legajo])

  useEffect(() => {
    if (!examId) return
    let mounted = true
    obtenerExamenPorId(examId).then((exam) => {
      if (!mounted) return
      if (exam.legajoProfe !== Number(user.legajo)) throw new Error('No tenés permiso para editar este examen.')
      if (exam.archivado || !isExamEditable(exam)) throw new Error('Este examen ya está en curso, finalizado o archivado y no se puede editar.')
      setOriginalExam(exam)
      if (!restoredDraft) setForm({ ...blankForm, ...exam, fecha: toDateValue(exam.fechaInicio), hora: toTimeValue(exam.fechaInicio), duracionMinutos: 120, temas: exam.temas?.length ? exam.temas.map((topic, index) => ({ ...topic, color: topic.color ?? topicColors[index % topicColors.length] })) : [] })
    }).catch((loadError) => mounted && setLoadError(loadError.message || 'No se pudo cargar el examen.')).finally(() => mounted && setLoadingExam(false))
    return () => { mounted = false }
  }, [examId, restoredDraft, user.legajo])

  const changeCourse = (event) => {
    const course = courses.find((item) => (item.idCurso ?? item.id) === event.target.value)
    setForm((current) => ({ ...current, cursoCodigo: event.target.value, materia: course?.materia ?? '', comisionId: course?.comisiones?.[0] ?? '' }))
  }
  const addTopic = () => {
    const nextIndex = form.temas.length
    setForm((current) => {
      const usedNames = new Set(current.temas.map((topic) => topic.nombreTema))
      let letterIndex = 0
      while (usedNames.has(`Tema ${String.fromCharCode(65 + letterIndex)}`)) letterIndex += 1
      const usedColors = new Set(current.temas.map((topic) => topic.color))
      const color = topicColors.find((candidate) => !usedColors.has(candidate)) ?? topicColors[current.temas.length % topicColors.length]
      return { ...current, temas: [...current.temas, { nombreTema: `Tema ${String.fromCharCode(65 + letterIndex)}`, color, preguntas: [] }] }
    })
    setActiveTopic(nextIndex)
    resetQuestionEditor()
  }
  const removeActiveTopic = () => {
    if (!currentTopic) return
    setForm((current) => ({ ...current, temas: current.temas.filter((_, index) => index !== activeTopic) }))
    setActiveTopic((current) => Math.max(0, current - 1))
    resetQuestionEditor()
  }
  const changeTopicColor = (color) => setForm((current) => ({ ...current, temas: current.temas.map((topic, index) => index === activeTopic ? { ...topic, color } : topic) }))
  const editQuestion = (index) => {
    const selected = currentTopic.preguntas[index]
    setQuestion({ consigna: selected.consigna, tipo: selected.tipo, puntaje: String(selected.puntaje) })
    setEditingQuestionIndex(index)
    setError('')
  }
  const addQuestion = () => {
    if (!question.consigna.trim()) return setError('Escribí la consigna antes de guardar la pregunta.')
    if (!isValidQuestionScore(question.puntaje)) return setError('El puntaje de cada pregunta debe ser un entero entre 1 y 10.')
    setError('')
    setForm((current) => ({ ...current, temas: current.temas.map((topic, index) => {
      if (index !== activeTopic) return topic
      const updatedQuestion = { idPregunta: editingQuestionIndex === null ? topic.preguntas.length + 1 : topic.preguntas[editingQuestionIndex].idPregunta, consigna: question.consigna.trim(), tipo: question.tipo, puntaje: Number(question.puntaje) }
      return { ...topic, preguntas: editingQuestionIndex === null ? [...topic.preguntas, updatedQuestion] : topic.preguntas.map((item, questionIndex) => questionIndex === editingQuestionIndex ? updatedQuestion : item) }
    }) }))
    resetQuestionEditor()
  }
  const removeQuestion = (removeIndex) => {
    setForm((current) => ({ ...current, temas: current.temas.map((topic, index) => index !== activeTopic ? topic : { ...topic, preguntas: topic.preguntas.filter((_, index) => index !== removeIndex).map((item, index) => ({ ...item, idPregunta: index + 1 })) }) }))
    resetQuestionEditor()
  }
  const openPreview = () => {
    if (!hasQuestions) return
    dispatch(previewOpened({ form, activeTopic, question, editingQuestionIndex, legajoProfe: Number(user.legajo), originPath: location.pathname + location.search }))
    navigate('/profesor/examPreview')
  }

  async function crearExamen(datosExamen) { return dispatch(saveTeacherExam({ datosExamen })).unwrap() }
  const save = async (estado) => {
    if (!formRef.current.reportValidity()) return
    if (estado !== 'borrador') {
      const start = new Date(`${form.fecha}T${form.hora}`).getTime()
      if (!Number.isFinite(start) || start <= Date.now()) return setError('La fecha y hora deben ser futuras.')
      if (!hasTenPointsPerTopic(form.temas)) return setScoreDialogOpen(true)
    }
    const topicColorSet = new Set(form.temas.map((topic) => topic.color))
    if (topicColorSet.size !== form.temas.length) return setError('Cada tema debe tener un color diferente.')
    setSaving(true)
    setError('')
    try {
      const datosExamen = { nombre: form.nombre.trim(), cursoCodigo: form.cursoCodigo, comisionId: form.comisionId ?? '', materia: form.materia.trim(), legajoProfe: Number(user.legajo), fecha: form.fecha, hora: form.hora, duracionMinutos: 120, toleranciaMinutos: Number(form.toleranciaMinutos), estado, tipoAsignacion: form.tipoAsignacion, temas: form.temas }
      if (examId) await dispatch(saveTeacherExam({ examId, datosExamen, legajoProfe: user.legajo })).unwrap()
      else await crearExamen(datosExamen)
      navigate('/profesor/misExamenes')
    } catch (saveError) { setError(saveError.message || 'No se pudo guardar el examen.') } finally { setSaving(false) }
  }

  if (loadingExam) return <TeacherShell><p className="table-message">Cargando examen…</p></TeacherShell>
  if (examId && loadError) return <TeacherShell><p className="error table-message">{loadError}</p><Link to="/profesor/misExamenes">← Volver a mis exámenes</Link></TeacherShell>
  if (examId && originalExam && !isExamEditable(originalExam, now)) return <TeacherShell><p className="error table-message">Este examen ya está en curso o finalizado y no se puede editar.</p><Link to="/profesor/misExamenes">← Volver a mis exámenes</Link></TeacherShell>

  return <TeacherShell>
    <section className="new-exam-header"><div><Link to="/profesor/misExamenes">← Mis exámenes</Link><h1>{examId ? 'Editar examen' : 'Nuevo examen'}</h1></div><span className={`status-pill ${form.estado}`}>{({ borrador: 'Borrador', programado: 'Programado', reprogramado: 'Reprogramado' })[form.estado] ?? form.estado}</span></section>
    <form ref={formRef} className="exam-form" onSubmit={(event) => event.preventDefault()}>
      <FormSection title="1 · Datos generales"><div className="form-grid">
        <Field label="Nombre del examen"><input name="nombre" value={form.nombre} onChange={change} required /></Field>
        <Field label="Curso"><select name="cursoCodigo" value={form.cursoCodigo} onChange={changeCourse} required disabled={loadingCourses}><option value="">{loadingCourses ? 'Cargando cursos…' : 'Seleccioná un curso'}</option>{courses.map((course) => <option key={course.id} value={course.idCurso ?? course.id}>{course.idCurso ?? course.id} · {course.materia}</option>)}</select></Field>
        <Field label="Comisión"><select name="comisionId" value={form.comisionId ?? ''} onChange={change} disabled={!form.cursoCodigo}><option value="">Sin comisión</option>{(courses.find((course) => (course.idCurso ?? course.id) === form.cursoCodigo)?.comisiones ?? []).map((commission) => <option key={commission} value={commission}>{commission}</option>)}</select></Field>
        <Field label="Materia"><input name="materia" value={form.materia} readOnly required /></Field>
        <Field label="Fecha"><input type="date" name="fecha" value={form.fecha} onChange={change} required /></Field>
        <Field label="Hora de inicio"><input type="time" name="hora" value={form.hora} onChange={change} required /></Field>
        <Field label="Duración"><input value="120 minutos (fija)" readOnly /></Field>
        <Field label="Tolerancia de ingreso (min)"><input type="number" min="0" name="toleranciaMinutos" value={form.toleranciaMinutos} onChange={change} required /></Field>
      </div></FormSection>
      <FormSection title="2 · Temas y asignación"><div className="topic-tabs">{form.temas.map((topic, index) => <button key={`${topic.nombreTema}-${index}`} type="button" className={index === activeTopic ? 'active' : ''} style={{ backgroundColor: topic.color, borderColor: topic.color }} aria-pressed={index === activeTopic} onClick={() => { setActiveTopic(index); resetQuestionEditor() }}>{topic.nombreTema}</button>)}<button type="button" className="add-topic" onClick={addTopic}>+ Agregar tema</button>{currentTopic && <button type="button" className="remove-topic" onClick={removeActiveTopic}>Eliminar tema</button>}</div>{currentTopic && <Field label={`Color de ${currentTopic.nombreTema}`}><input className="topic-color" type="color" value={currentTopic.color} onChange={(event) => changeTopicColor(event.target.value)} /></Field>}<Field label="Cómo se asigna el tema a cada alumno"><select name="tipoAsignacion" value={form.tipoAsignacion} onChange={change}><option>Automático (alternado por legajo)</option><option>Manual</option><option>Aleatorio</option></select></Field></FormSection>
      {currentTopic ? <FormSection title={`3 · Preguntas del ${currentTopic.nombreTema}`} aside={`Total: ${total} pts`}><div className="question-list">{currentTopic.preguntas.map((item, index) => <article key={item.idPregunta} className="question-row"><span>{String(index + 1).padStart(2, '0')}</span><p>{item.consigna}</p><em>{item.tipo}</em><strong>{item.puntaje} pts</strong><button type="button" className="edit-question" onClick={() => editQuestion(index)}>Editar</button><button type="button" onClick={() => removeQuestion(index)}>Quitar</button></article>)}</div><div className="question-builder"><Field label="Consigna"><input value={question.consigna} onChange={(event) => setQuestion((current) => ({ ...current, consigna: event.target.value }))} placeholder="Escribí la consigna" /></Field><Field label="Tipo de pregunta"><select value={question.tipo} onChange={(event) => setQuestion((current) => ({ ...current, tipo: event.target.value }))}><option>Texto</option><option>Tabla de decisión</option><option>Árbol de decisión</option><option>Prueba unitaria</option></select></Field><Field label="Puntaje"><input type="number" min="1" max="10" step="1" value={question.puntaje} onChange={(event) => changeQuestionScore(event.target.value)} /></Field><button type="button" className="secondary-action" onClick={addQuestion}>{editingQuestionIndex === null ? '+ Agregar pregunta' : 'Guardar pregunta'}</button>{editingQuestionIndex !== null && <button type="button" className="secondary-action" onClick={resetQuestionEditor}>Cancelar edición</button>}</div></FormSection> : <p className="empty-topics">No hay temas. Agregá uno para incluir preguntas.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="secondary-action" onClick={openPreview} disabled={!hasQuestions || saving}>Vista previa como alumno</button>{examId ? <><button type="button" className="primary-action button-action" onClick={() => save(form.estado)} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{form.estado === 'borrador' && <button type="button" className="primary-action button-action" onClick={() => save('programado')} disabled={saving}>Publicar examen</button>}</> : <><button type="button" className="secondary-action" onClick={() => save('borrador')} disabled={saving}>Guardar borrador</button><button type="button" className="primary-action button-action" onClick={() => save('programado')} disabled={saving}>{saving ? 'Guardando…' : 'Publicar examen'}</button></>}</div>
    </form>
    {scoreDialogOpen && <ConfirmDialog titleId="exam-score-dialog-title" title="Puntaje del examen" actions={<button type="button" className="primary-action button-action" onClick={() => setScoreDialogOpen(false)}>Aceptar</button>}><p>La sumatoria de puntaje de las preguntas debe ser igual a 10</p></ConfirmDialog>}
  </TeacherShell>
}
