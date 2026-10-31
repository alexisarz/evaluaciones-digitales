import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import StudentShell from '../components/StudentShell'
import { useAuth } from '../features/auth/useAuth'
import { loadPublishedStudentCorrection, selectStudentReview, selectStudentReviewError, selectStudentReviewLoading } from '../features/studentExams/studentExamsSlice'
import { correctionTone } from '../features/corrections/correctionRules'
import { formatExamDateTime } from '../utils/examWindow'
import CorrectionQuestionReview from '../shared/components/CorrectionQuestionReview'

export default function StudentCorrectionPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [params] = useSearchParams()
  const examId = params.get('id')
  const delivery = useSelector(selectStudentReview)
  const loading = useSelector(selectStudentReviewLoading)
  const error = useSelector(selectStudentReviewError)
  const current = delivery?.examenId === examId ? delivery : null
  const maximum = current?.preguntas?.reduce((sum, question) => sum + Number(question.puntajeMaximo ?? 0), 0) ?? 0

  useEffect(() => {
    if (!examId) return undefined
    const request = dispatch(loadPublishedStudentCorrection({ examId, legajo: user.legajo }))
    return () => request.abort()
  }, [dispatch, examId, user.legajo])

  return <StudentShell>
    <div className="student-correction-page">
      <Link className="student-correction-back" to="/alumno/misExamenes">← Mis exámenes</Link>
      <h1>Corrección de {current?.nombreExamen ?? 'tu examen'}</h1>
      {loading && <p role="status">Cargando corrección…</p>}
      {!examId && <p className="error" role="alert">Falta el ID del examen.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {current && !loading && <>
        <p className="correction-subtitle">{current.materia} · {current.cursoCodigo} · {current.comisionId}</p>
        <div className="student-correction-summary">
          <span className="correction-topic" style={{ backgroundColor: current.tema?.color ?? '#244a87' }}>{current.tema?.nombreTema ?? 'Sin tema'}</span>
          <strong className={`correction-confirm-score ${correctionTone(current.nota)}`}>Nota: {current.nota} / {maximum}</strong>
          {current.fechaPublicacionNota && <small>Publicada el {formatExamDateTime(Date.parse(current.fechaPublicacionNota))}</small>}
        </div>
        {(current.preguntas ?? []).map((question, index) => <CorrectionQuestionReview
          key={question.idPregunta}
          question={question}
          index={index}
          total={current.preguntas.length}
          answer={current.respuestas?.find((item) => Number(item.idPregunta) === Number(question.idPregunta))}
          correction={current.correccion?.find((item) => Number(item.idPregunta) === Number(question.idPregunta))}
        />)}
        <Link className="secondary-action dashboard-link" to="/alumno/misExamenes">Volver a Mis exámenes</Link>
      </>}
    </div>
  </StudentShell>
}
