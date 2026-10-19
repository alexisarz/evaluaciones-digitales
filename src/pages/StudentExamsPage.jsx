import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { attemptToDraft, comenzarORecuperarExamen, entregarExamen, obtenerIntento } from '../services/examAttemptService'
import { eliminarBorradorLocal, guardarBorradorLocal } from '../services/localExamDraft'
import { attemptUpserted, loadStudentExams, localDraftRemoved, selectAttemptsByExam, selectStudentCourses, selectStudentLoadError, selectStudentLoading, selectStudentLocalDrafts, selectVisibleStudentExams } from '../features/studentExams/studentExamsSlice'
import { examWindowMessage, formatExamDateTime, getExamSchedule, getExamWindowStatus } from '../utils/examWindow'
import ConfirmDialog from '../shared/components/ConfirmDialog'

export default function StudentExamsPage() {
  const { user, logout } = useAuth()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const courses = useSelector(selectStudentCourses)
  const localDrafts = useSelector(selectStudentLocalDrafts)
  const attemptsByExam = useSelector(selectAttemptsByExam)
  const visibleExams = useSelector((state) => selectVisibleStudentExams(state, user.cursosActivos))
  const loading = useSelector(selectStudentLoading)
  const loadError = useSelector(selectStudentLoadError)
  const [selectedTopics, setSelectedTopics] = useState({})
  const [confirmExam, setConfirmExam] = useState(null)
  const [startError, setStartError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retryingId, setRetryingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const error = actionError || loadError
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const request = dispatch(loadStudentExams({ legajo: user.legajo, cursosActivos: user.cursosActivos ?? [] }))
    return () => request.abort()
  }, [dispatch, user.legajo, user.cursosActivos])

  const leaveConfirmation = () => {
    const examId = confirmExam?.id
    setConfirmExam(null)
    setStartError('')
    if (examId) setSelectedTopics((current) => {
      const next = { ...current }
      delete next[examId]
      return next
    })
  }

  const begin = async () => {
    const exam = confirmExam
    const topic = selectedTopics[exam?.id]
    if (!exam || !topic) return
    setBusy(true)
    setActionError('')
    setStartError('')
    try {
      const examWindow = getExamWindowStatus(exam)
      if (examWindow.status !== 'open') throw new Error(examWindowMessage(examWindow))
      const fullscreenRequest = document.documentElement.requestFullscreen?.()
      fullscreenRequest?.catch(() => {})
      const attempt = await comenzarORecuperarExamen(exam, topic, user)
      if (attempt.estadoEntrega !== 'en_curso') {
        throw new Error('Este examen ya fue entregado o está pendiente de envío.')
      }
      await guardarBorradorLocal(attemptToDraft(attempt)).catch(() => {})
      setConfirmExam(null)
      navigate(`/alumno/realizarExamen?id=${encodeURIComponent(exam.id)}`)
    } catch (startError) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      setStartError(startError.message || 'No se pudo comenzar el examen.')
    } finally { setBusy(false) }
  }

  const retry = async (attempt) => {
    const draft = localDrafts.find((item) => item.examenId === attempt.examenId && item.estadoEntrega === 'pendiente_envio')
    if (!draft) return setActionError('No se encontró el guardado local de esta entrega.')
    setRetryingId(attempt.examenId)
    setActionError('')
    try {
      const remote = await obtenerIntento(attempt.examenId, user.legajo)
      if (remote?.estadoEntrega !== 'entregado') await entregarExamen(remote ?? draft, draft, draft.motivoEntrega ?? 'reintento')
      await eliminarBorradorLocal(draft.id).catch(() => {})
      dispatch(localDraftRemoved(draft.id))
      const completed = await obtenerIntento(attempt.examenId, user.legajo)
      if (completed) dispatch(attemptUpserted(completed))
    } catch { setActionError('No se pudo completar la entrega. Conservamos tu examen localmente para volver a intentar.') } finally { setRetryingId(null) }
  }

  return <main className="student-page">
    <header className="student-header"><div className="brand">Evaluación Digital <span>Alumno</span></div><span className="student-account">Legajo {user.legajo} · {user.nombre} {user.apellido}</span><button onClick={logout}>Cerrar sesión</button></header>
    <section className="student-content">
      <h1>Mis exámenes</h1><p>Vas a ver únicamente los exámenes habilitados para tus cursos.</p>
      {loading && <p>Cargando exámenes…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && courses.length === 0 && <p className="notice">No estás asignado/a a ningún curso. Contactá a la administración.</p>}
      {!loading && courses.length > 0 && visibleExams.length === 0 && <p className="notice">No hay exámenes habilitados para tus cursos.</p>}
      <div className="student-exams">{visibleExams.map((exam) => {
        const attempt = attemptsByExam.get(exam.id)
        const selected = selectedTopics[exam.id]
        const schedule = getExamSchedule(exam)
        const examWindow = getExamWindowStatus(exam, now)
        const timeOver = schedule && now >= schedule.endMs
        const expired = (!attempt && examWindow.status === 'expired') || (attempt?.estadoEntrega === 'en_curso' && timeOver)
        return <article className={`student-exam${expired ? ' expired' : ''}`} key={exam.id}>
          <small>{exam.cursoCodigo} · {exam.comisionId || 'Sin comisión'} · {exam.materia}</small>
          <h2>{exam.nombre}</h2>
          {schedule ? <div className="student-exam-schedule"><p><strong>Inicio:</strong> {formatExamDateTime(schedule.startMs)}</p><p><strong>Tolerancia para ingresar:</strong> {schedule.toleranceMinutes} min · hasta el {formatExamDateTime(schedule.deadlineMs)}</p><p><strong>Finaliza:</strong> {formatExamDateTime(schedule.endMs)} ({schedule.durationMinutes} min desde el inicio programado)</p></div> : <p className="student-exam-schedule-unavailable">Fecha y tolerancia de ingreso no disponibles.</p>}
          {expired && <p className="expired-exam-label">{timeOver && attempt?.estadoEntrega === 'en_curso' ? 'Terminó el tiempo. Ingresá para entregar tus respuestas.' : examWindowMessage(examWindow)}</p>}
          {attempt?.estadoEntrega === 'entregado' && <p className="exam-delivered">Entregado · Corrección {attempt.estadoCorreccion ?? 'pendiente'}</p>}
          {attempt?.estadoEntrega === 'pendiente_envio' && <div className="pending-delivery"><p>Entrega pendiente por un error de conexión. Tus respuestas están guardadas en este dispositivo.</p><button type="button" onClick={() => retry(attempt)} disabled={retryingId === exam.id}>{retryingId === exam.id ? 'Reintentando…' : 'REINTENTAR ENTREGA'}</button></div>}
          {attempt?.estadoEntrega === 'en_curso' && <div className="exam-resume"><p>{timeOver ? 'Tiempo agotado' : 'Examen en curso'} · {attempt.tema?.nombreTema}</p><button type="button" onClick={() => navigate(`/alumno/realizarExamen?id=${encodeURIComponent(exam.id)}`)}>{timeOver ? 'Finalizar entrega' : 'Continuar examen'}</button></div>}
          {!attempt && ['upcoming', 'open'].includes(examWindow.status) && (selected ? <div className="selected-topic" style={{ backgroundColor: selected.color ?? '#244a87' }}><strong>TEMA: {selected.nombreTema}</strong><p>Confirmá para comenzar. Después no podrás cambiar de tema.</p><button type="button" className="clock-in-button" onClick={() => { setStartError(''); setConfirmExam(exam) }}>CLOCK IN</button></div> : <div><p>Seleccioná tu tema:</p><div className="student-topic-list">{exam.temas?.map((topic) => <button key={topic.nombreTema} type="button" style={{ backgroundColor: topic.color ?? '#244a87' }} onClick={() => setSelectedTopics((current) => ({ ...current, [exam.id]: topic }))}>{topic.nombreTema}</button>)}</div></div>)}
        </article>
      })}</div>
    </section>
    {confirmExam && <ConfirmDialog titleId="begin-title" title={startError ? 'No podés comenzar este examen' : 'Comenzar examen'} actions={startError ? <button type="button" className="primary-action button-action" onClick={leaveConfirmation}>Aceptar</button> : <><button type="button" className="secondary-action" onClick={leaveConfirmation} disabled={busy}>Salir</button><button type="button" className="primary-action button-action" onClick={begin} disabled={busy}>{busy ? 'Comenzando…' : 'Comenzar'}</button></>}>
      {startError ? <p className="start-exam-error" role="alert">{startError}</p> : <p>Estás a punto de comenzar el examen. Tendrás hasta el {getExamSchedule(confirmExam) ? formatExamDateTime(getExamSchedule(confirmExam).endMs) : 'horario de finalización programado'} para entregarlo; si ingresás tarde, dispondrás de menos tiempo. Al continuar no podrás iniciar otro intento ni cambiar de tema.</p>}
    </ConfirmDialog>}
  </main>
}
