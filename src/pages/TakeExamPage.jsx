import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import {
  attemptIdFor,
  attemptToDraft,
  clampDraftToExamEnd,
  entregarExamen,
  guardarProgresoRemoto,
  obtenerIntento,
  registrarIncidente,
} from '../services/examAttemptService'
import { eliminarBorradorLocal, guardarBorradorLocal, obtenerBorradorLocal } from '../services/localExamDraft'
import ExamQuestionContent from '../shared/components/ExamQuestionContent'

const TAB_INCIDENT = 'Alumno salió de pestaña'

function timeLabel(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function TakeExamPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const examId = searchParams.get('id')
  const [attempt, setAttempt] = useState(null)
  const [draft, setDraft] = useState(null)
  const draftRef = useRef(null)
  const submittingRef = useRef(false)
  const savingRef = useRef(false)
  const expiredRef = useRef(false)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [saveState, setSaveState] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deliveryError, setDeliveryError] = useState('')
  const [showSubmit, setShowSubmit] = useState(false)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))

  useEffect(() => {
    if (!examId) { setError('Falta el ID del examen.'); setLoading(false); return }
    let mounted = true
    async function load() {
      try {
        const [remote, local] = await Promise.all([
          obtenerIntento(examId, user.legajo).catch(() => null),
          obtenerBorradorLocal(attemptIdFor(examId, user.legajo)).catch(() => null),
        ])
        if (!mounted) return
        if (remote?.estadoEntrega === 'entregado') {
          navigate(`/alumno/examenExistoso?id=${encodeURIComponent(examId)}`, { replace: true })
          return
        }
        if (local?.estadoEntrega === 'pendiente_envio') {
          navigate(`/alumno/errorExamen?id=${encodeURIComponent(examId)}`, { replace: true })
          return
        }
        if (!remote && !local) throw new Error('No existe un intento iniciado para este examen.')
        const current = remote ?? local
        if (Number(current.legajoAlumno) !== Number(user.legajo) || !user.cursosActivos?.includes(current.cursoCodigo)) {
          throw new Error('No tenés acceso a este examen.')
        }
        const remoteDraft = remote ? attemptToDraft(remote) : null
        const recovered = local && (!remoteDraft || local.ultimaEdicionMs > remoteDraft.ultimaEdicionMs)
          ? { ...remoteDraft, ...local }
          : remoteDraft
        const restored = clampDraftToExamEnd(recovered ?? local, remote ?? local)
        draftRef.current = restored
        setDraft(restored)
        setAttempt(current)
        setLastSavedAt(remote?.ultimaActualizacion?.toMillis?.() ?? null)
        setSaveState(local && local.ultimaEdicionMs > (remoteDraft?.ultimaEdicionMs ?? 0) ? 'local' : 'saved')
        await guardarBorradorLocal(restored).catch(() => setSaveState('local-error'))
      } catch (loadError) { if (mounted) setError(loadError.message || 'No se pudo recuperar el examen.') } finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [examId, navigate, user.cursosActivos, user.legajo])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const persistCurrentDraft = useCallback(async () => {
    const current = draftRef.current
    if (!current || current.estadoEntrega !== 'en_curso' || savingRef.current) return
    savingRef.current = true
    let savedLocally = false
    try {
      await guardarBorradorLocal(current)
      savedLocally = true
      setSaveState('local')
    } catch { setSaveState('local-error') }
    try {
      if (navigator.onLine) {
        await guardarProgresoRemoto(current.examenId, current.legajoAlumno, current.respuestas, current.incidentes, current.ultimaEdicionMs)
        setLastSavedAt(Date.now())
        setSaveState('saved')
      }
    } catch { setSaveState(savedLocally ? 'local' : 'local-error') } finally { savingRef.current = false }
  }, [])

  useEffect(() => {
    if (!draftRef.current || draftRef.current.estadoEntrega !== 'en_curso') return
    const interval = setInterval(() => { void persistCurrentDraft() }, 10_000)
    const onOnline = () => { void persistCurrentDraft() }
    window.addEventListener('online', onOnline)
    return () => { clearInterval(interval); window.removeEventListener('online', onOnline) }
  }, [draft?.id, draft?.estadoEntrega, persistCurrentDraft])

  useEffect(() => {
    if (!draftRef.current || draftRef.current.estadoEntrega !== 'en_curso') return
    function onVisibilityChange() {
      if (!document.hidden || submittingRef.current) return
      const current = draftRef.current
      if (!current) return
      const next = {
        ...current,
        incidentes: [...new Set([...current.incidentes, TAB_INCIDENT])],
        ultimaEdicionMs: Date.now(),
      }
      draftRef.current = next
      setDraft(next)
      setShowTabWarning(true)
      void guardarBorradorLocal(next).catch(() => setSaveState('local-error'))
      void registrarIncidente(next.examenId, next.legajoAlumno, TAB_INCIDENT).catch(() => setSaveState('local'))
    }
    function onFullscreenChange() { setFullscreen(Boolean(document.fullscreenElement)) }
    function onBeforeUnload(event) { event.preventDefault(); event.returnValue = '' }
    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [draft?.id, draft?.estadoEntrega])

  const remaining = Math.max(0, (draft?.fechaLimiteMs ?? now) - now)

  const changeAnswer = (event) => {
    const current = draftRef.current
    if (!current || remaining === 0) return
    const question = current.preguntas[questionIndex]
    if (!question) return
    const next = {
      ...current,
      respuestas: current.respuestas.map((answer) => answer.idPregunta === question.idPregunta
        ? { ...answer, respuestaTexto: event.target.value }
        : answer),
      ultimaEdicionMs: Date.now(),
    }
    draftRef.current = next
    setDraft(next)
    setSaveState('pending')
  }

  const submit = useCallback(async (motivo) => {
    if (submittingRef.current || !draftRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setShowSubmit(false)
    setDeliveryError('')
    const current = draftRef.current
    const pending = { ...current, estadoEntrega: 'pendiente_envio', motivoEntrega: motivo, fechaEntregaMs: current.fechaEntregaMs ?? Date.now() }
    draftRef.current = pending
    setDraft(pending)
    let savedLocally = false
    try {
      await guardarBorradorLocal(pending)
      savedLocally = true
    } catch { setSaveState('local-error') }
    try {
      if (!navigator.onLine) throw new Error('Sin conexión')
      await Promise.race([
        entregarExamen(attempt, pending, motivo),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), 12_000)),
      ])
      await eliminarBorradorLocal(pending.id).catch(() => {})
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      navigate(`/alumno/examenExistoso?id=${encodeURIComponent(examId)}`, { replace: true })
    } catch {
      setDeliveryError(savedLocally
        ? 'Ocurrió un error al entregar el examen. Tus respuestas quedaron guardadas en este dispositivo; reintentá el envío.'
        : 'Ocurrió un error al entregar el examen y no se pudo crear un respaldo local. Reintentá ahora sin cerrar esta pestaña.')
      if (motivo === 'tiempo_agotado' && savedLocally) navigate(`/alumno/errorExamen?id=${encodeURIComponent(examId)}`, { replace: true })
    } finally { submittingRef.current = false; setSubmitting(false) }
  }, [attempt, examId, navigate])

  useEffect(() => {
    const current = draftRef.current
    if (current && remaining === 0 && current.estadoEntrega === 'en_curso' && !expiredRef.current) {
      expiredRef.current = true
      void submit('tiempo_agotado')
    }
  }, [remaining, draft?.id, draft?.estadoEntrega, submit])

  if (loading) return <main className="exam-loading">Recuperando examen…</main>
  if (error || !draft) return <main className="exam-loading"><p className="error">{error || 'No se encontró el examen.'}</p><Link to="/alumno/misExamenes">Volver a mis exámenes</Link></main>

  const question = draft.preguntas[questionIndex]
  const answer = draft.respuestas.find((item) => item.idPregunta === question?.idPregunta)
  const canEdit = remaining > 0 && draft.estadoEntrega === 'en_curso' && !submitting
  const savedSeconds = lastSavedAt ? Math.max(0, Math.floor((now - lastSavedAt) / 1000)) : null

  return <main className="exam-screen">
    <header className="exam-topic-banner" style={{ backgroundColor: draft.tema.color }}>
      <strong>{draft.tema.nombreTema}</strong><span>{draft.nombreExamen} — {draft.materia}</span>
      <div className={`exam-countdown ${remaining <= 30 * 60_000 ? 'urgent' : ''}`} role="timer" aria-label="Tiempo restante">Tiempo {timeLabel(remaining)}</div>
    </header>
    <div className="exam-restriction" role="note"><span className="exam-restriction-icon" aria-hidden="true">⚠</span><span>Modo examen restringido: {fullscreen ? 'pantalla completa activa.' : 'activá la pantalla completa.'} Salir de la pestaña se reporta como incidente.</span>{!fullscreen && <button type="button" onClick={() => document.documentElement.requestFullscreen?.()?.catch(() => {})}>Activar pantalla completa</button>}</div>
    {remaining === 0 && <div className="exam-timeout" role="alert">Se agotó el tiempo. El examen está bloqueado y sólo se puede entregar.</div>}
    {remaining > 0 && remaining <= 5 * 60_000 && <div className="exam-time-warning" role="alert">Quedan menos de 5 minutos para entregar.</div>}
    <section className="exam-question-area">
      <div className="exam-question-meta"><span>Pregunta {question ? questionIndex + 1 : 0} de {draft.preguntas.length}</span><span className={`save-pill ${saveState}`}>{saveState === 'saved' && savedSeconds !== null ? `● Guardado hace ${savedSeconds} s` : saveState === 'local-error' ? 'No se pudo guardar en este dispositivo' : saveState === 'local' ? '● Guardado localmente · sincronización pendiente' : '● Guardando…'}</span></div>
      {question ? <ExamQuestionContent question={question} answer={answer?.respuestaTexto ?? ''} onAnswerChange={changeAnswer} disabled={!canEdit} /> : <div className="notice">Este tema no tiene preguntas. Podés entregar el examen.</div>}
    </section>
    <footer className="exam-footer"><div className="exam-nav"><button type="button" className="secondary-action" onClick={() => setQuestionIndex((index) => index - 1)} disabled={!canEdit || questionIndex === 0}>← Anterior</button><button type="button" className="primary-action button-action" onClick={() => setQuestionIndex((index) => index + 1)} disabled={!canEdit || questionIndex >= draft.preguntas.length - 1}>Siguiente →</button></div><div className="exam-submit"><p className="error" role="alert">{deliveryError}</p><button type="button" className="danger-action" onClick={() => remaining === 0 || draft.estadoEntrega === 'pendiente_envio' ? void submit(draft.motivoEntrega ?? 'tiempo_agotado') : setShowSubmit(true)} disabled={submitting}>{submitting ? 'ENTREGANDO…' : draft.estadoEntrega === 'pendiente_envio' ? 'REINTENTAR ENTREGA' : 'ENTREGAR EXAMEN'}</button></div></footer>
    {showSubmit && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="submit-title"><h2 id="submit-title">Entregar examen</h2><p>Estás por finalizar y entregar tu examen. Una vez hecho no podrás editarlo, te recomendamos revisarlo. ¿Estás seguro de que querés entregarlo?</p><div><button type="button" className="secondary-action" onClick={() => setShowSubmit(false)}>Cancelar</button><button type="button" className="danger-action" onClick={() => void submit('manual')}>Entregar</button></div></section></div>}
    {showTabWarning && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="tab-title"><h2 id="tab-title">Incidencia reportada</h2><p>Acabás de salir de la pestaña del examen. Esto fue <strong>reportado como incidencia al profesor</strong> y figurará en la entrega del examen.</p><div><button type="button" className="primary-action button-action" onClick={() => setShowTabWarning(false)}>Aceptar</button></div></section></div>}
  </main>
}
