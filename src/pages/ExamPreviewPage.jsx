import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { selectExamPreviewDraft } from '../features/teacherExams/examPreviewSlice'
import ExamQuestionContent from '../shared/components/ExamQuestionContent'

export default function ExamPreviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const preview = useSelector(selectExamPreviewDraft)
  const [topicIndex, setTopicIndex] = useState(preview?.activeTopic ?? 0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const validPreview = preview && Number(preview.legajoProfe) === Number(user.legajo)

  useEffect(() => {
    if (!validPreview) return undefined
    const warnBeforeRefresh = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeRefresh)
    return () => window.removeEventListener('beforeunload', warnBeforeRefresh)
  }, [validPreview])

  if (!validPreview) return <main className="exam-loading"><h1>Vista previa no disponible</h1><p>La vista previa existe sólo mientras el formulario está abierto. Si actualizaste la página, los cambios no guardados se perdieron.</p><Link to="/profesor/misExamenes">Volver a mis exámenes</Link></main>

  const temas = preview.form.temas ?? []
  const topic = temas[topicIndex]
  const questions = topic?.preguntas ?? []
  const question = questions[questionIndex]
  const answerKey = `${topicIndex}:${question?.idPregunta}`
  const exit = () => navigate(preview.originPath)

  return <main className="exam-screen preview-screen">
    <header className="exam-topic-banner preview-banner" style={{ backgroundColor: topic?.color ?? '#244a87' }}>
      <strong>{topic?.nombreTema ?? 'Sin tema'}</strong>
      <span>{preview.form.nombre || 'Examen sin título'} — {preview.form.materia || 'Materia sin asignar'}</span>
      <span className="preview-pill">Vista previa del alumno</span>
    </header>
    {temas.length > 1 && <nav className="preview-topic-switcher" aria-label="Temas de la vista previa">
      {temas.map((item, index) => <button key={`${item.nombreTema}-${index}`} type="button" aria-pressed={index === topicIndex} style={{ backgroundColor: item.color ?? '#244a87' }} onClick={() => { setTopicIndex(index); setQuestionIndex(0) }}>{item.nombreTema}</button>)}
    </nav>}
    <section className="exam-question-area">
      <div className="exam-question-meta"><span>Pregunta {question ? questionIndex + 1 : 0} de {questions.length}</span><span className="preview-note">Simulación sin guardado ni entrega</span></div>
      {question ? <ExamQuestionContent question={question} answer={answers[answerKey] ?? ''} onAnswerChange={(event) => setAnswers((current) => ({ ...current, [answerKey]: event.target.value }))} inputId="preview-answer" /> : <p className="notice">Este tema todavía no tiene preguntas. Elegí otro tema para revisarlo.</p>}
    </section>
    <footer className="exam-footer"><div className="exam-nav"><button type="button" className="secondary-action" onClick={() => setQuestionIndex((index) => index - 1)} disabled={questionIndex === 0}>← Anterior</button><button type="button" className="primary-action button-action" onClick={() => setQuestionIndex((index) => index + 1)} disabled={questionIndex >= questions.length - 1}>Siguiente →</button></div><button type="button" className="secondary-action preview-exit" onClick={exit}>Salir de vista previa</button></footer>
  </main>
}
