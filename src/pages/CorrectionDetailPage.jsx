import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import { useAuth } from '../features/auth/useAuth'
import { correctionTone, correctionTotal, normalizeCorrection } from '../features/corrections/correctionRules'
import { finishCorrection, loadCorrectionDelivery, saveCorrectionDraft, selectCorrectionDelivery, selectCorrectionDetailError, selectCorrectionDetailLoading } from '../features/corrections/correctionsSlice'

const entriesFromDelivery = (delivery) => (delivery.preguntas ?? []).map((question) => {
  const saved = delivery.correccion?.find((entry) => Number(entry.idPregunta) === Number(question.idPregunta))
  return { idPregunta: Number(question.idPregunta), puntaje: saved?.puntaje ?? null, comentario: saved?.comentario ?? '' }
})

export default function CorrectionDetailPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const deliveryId = params.get('id')
  const delivery = useSelector(selectCorrectionDelivery)
  const loading = useSelector(selectCorrectionDetailLoading)
  const loadError = useSelector(selectCorrectionDetailError)
  const [correction, setCorrection] = useState([])
  const [readyId, setReadyId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const initializedId = useRef(null)
  const latestCorrection = useRef([])
  const dirtyRef = useRef(false)
  const finishedRef = useRef(false)
  const editVersion = useRef(0)
  const saveQueue = useRef(Promise.resolve())
  const currentDelivery = readyId === deliveryId && delivery?.id === deliveryId ? delivery : null
  const backPath = currentDelivery ? `/profesor/corregirExamen?id=${encodeURIComponent(currentDelivery.examenId)}` : '/profesor/correcciones'
  const corrected = currentDelivery?.estadoCorreccion === 'corregido'

  const enqueueSave = useCallback((entries) => {
    const task = saveQueue.current.catch(() => {}).then(() =>
      dispatch(saveCorrectionDraft({ deliveryId, legajoProfe: user.legajo, correction: entries })).unwrap())
    saveQueue.current = task
    return task
  }, [deliveryId, dispatch, user.legajo])

  useEffect(() => {
    if (!deliveryId) return undefined
    let active = true
    setReadyId(null)
    const request = dispatch(loadCorrectionDelivery({ deliveryId, legajoProfe: user.legajo }))
    void request.unwrap().then(() => { if (active) setReadyId(deliveryId) }).catch(() => {})
    return () => { active = false; request.abort() }
  }, [deliveryId, dispatch, user.legajo])

  useEffect(() => {
    if (!currentDelivery || initializedId.current === deliveryId) return
    initializedId.current = deliveryId
    const initial = entriesFromDelivery(currentDelivery)
    latestCorrection.current = initial
    setCorrection(initial)
    if (!corrected && !currentDelivery.correccionIniciada) {
      void enqueueSave(initial).catch(() => setError('No se pudo iniciar la corrección. Revisá la conexión e intentá guardar antes de salir.'))
    }
  }, [currentDelivery, corrected, deliveryId, enqueueSave])

  useEffect(() => {
    if (!dirty || !currentDelivery || corrected || confirmation || saving) return undefined
    const entries = correction
    const version = editVersion.current
    const timer = setTimeout(() => {
      void enqueueSave(entries).then(() => {
        if (version === editVersion.current) { dirtyRef.current = false; setDirty(false); setError('') }
      }).catch(() => setError('No se pudo guardar el avance automáticamente. Intentá salir con el botón para reintentar.'))
    }, 2000)
    return () => clearTimeout(timer)
  }, [correction, corrected, currentDelivery, dirty, enqueueSave, confirmation, saving])

  useEffect(() => {
    const warnOnRefresh = (event) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnOnRefresh)
    return () => window.removeEventListener('beforeunload', warnOnRefresh)
  }, [])

  useEffect(() => () => {
    if (dirtyRef.current && !finishedRef.current && initializedId.current === deliveryId) {
      void enqueueSave(latestCorrection.current).catch(() => {})
    }
  }, [deliveryId, enqueueSave])

  const changeEntry = (question, field, value) => {
    if (field === 'puntaje' && value !== '') {
      if (!/^\d+(?:\.\d*)?$/.test(value) || Number(value) > Number(question.puntajeMaximo)) return
    }
    const next = latestCorrection.current.map((entry) => Number(entry.idPregunta) === Number(question.idPregunta) ? { ...entry, [field]: value } : entry)
    latestCorrection.current = next
    editVersion.current += 1
    dirtyRef.current = true
    setCorrection(next)
    setDirty(true)
    setError('')
  }

  const exit = async () => {
    if (!currentDelivery) return
    setSaving(true)
    setError('')
    try {
      const normalized = normalizeCorrection(currentDelivery.preguntas, latestCorrection.current)
      await enqueueSave(normalized)
      dirtyRef.current = false
      setDirty(false)
      navigate(backPath)
    } catch (caught) { setError(caught.message || 'No se pudo guardar la corrección.') } finally { setSaving(false) }
  }

  const requestFinish = () => {
    try {
      const normalized = normalizeCorrection(currentDelivery.preguntas, latestCorrection.current, true)
      setError('')
      setConfirmation({ correction: normalized, total: correctionTotal(normalized) })
    } catch (caught) { setError(caught.message) }
  }

  const confirmFinish = async () => {
    if (!confirmation || !currentDelivery) return
    setSaving(true)
    setError('')
    try {
      await saveQueue.current.catch(() => {})
      await dispatch(finishCorrection({ deliveryId, legajoProfe: user.legajo, correction: confirmation.correction })).unwrap()
      finishedRef.current = true
      dirtyRef.current = false
      setDirty(false)
      setConfirmation(null)
      navigate(backPath)
    } catch (caught) { setError(caught.message || 'No se pudo finalizar la corrección.'); setConfirmation(null) } finally { setSaving(false) }
  }

  return <TeacherShell>
    <section className="new-exam-header"><div>{currentDelivery && !corrected ? <button type="button" className="correction-back-link" onClick={exit} disabled={saving}>← Entregas del examen</button> : <Link to={backPath}>← Entregas del examen</Link>}<h1>{corrected ? 'Corrección finalizada' : 'Corregir entrega'}</h1></div></section>
    {!deliveryId && <p className="error" role="alert">Falta el ID de la entrega.</p>}
    {loading && <p className="table-message">Cargando entrega…</p>}
    {loadError && <p className="error" role="alert">{loadError}</p>}
    {!loading && !loadError && currentDelivery && <div className="correction-detail">
      <section className="form-section correction-student"><div><h2>{currentDelivery.nombreAlumno} {currentDelivery.apellidoAlumno}</h2><p>Legajo {currentDelivery.legajoAlumno} · {currentDelivery.nombreExamen} · {currentDelivery.materia}</p></div><span className="correction-topic" style={{ backgroundColor: currentDelivery.tema?.color ?? '#244a87' }}>{currentDelivery.tema?.nombreTema ?? 'Sin tema'}</span></section>
      {currentDelivery.incidentes?.length > 0 && <section className="correction-incidents" role="note"><strong>Incidencias registradas durante este examen</strong><ul>{currentDelivery.incidentes.map((incident, index) => <li key={`${incident}-${index}`}>{incident}</li>)}</ul></section>}
      {(currentDelivery.preguntas ?? []).map((question, index) => {
        const answer = currentDelivery.respuestas?.find((item) => Number(item.idPregunta) === Number(question.idPregunta))
        const entry = correction.find((item) => Number(item.idPregunta) === Number(question.idPregunta))
        return <section className="form-section correction-question" key={question.idPregunta}>
          <div className="correction-question-heading"><span>Pregunta {index + 1} de {currentDelivery.preguntas.length}</span><span>{question.tipo} · máximo {question.puntajeMaximo} pts</span></div>
          <h2>{question.consigna}</h2>
          <div className="correction-answer"><strong>Respuesta del alumno</strong><p>{answer?.respuestaTexto?.trim() || 'Sin respuesta'}</p></div>
          <div className="correction-fields"><label>Puntaje (0 a {question.puntajeMaximo})<input type="number" min="0" max={question.puntajeMaximo} step="any" value={entry?.puntaje ?? ''} onChange={(event) => changeEntry(question, 'puntaje', event.target.value)} disabled={corrected || saving} placeholder="Sin puntuar" /></label><label>Comentarios de corrección<textarea value={entry?.comentario ?? ''} onChange={(event) => changeEntry(question, 'comentario', event.target.value)} disabled={corrected || saving} placeholder="Escribí un comentario para esta pregunta…" /></label></div>
        </section>
      })}
      {corrected && <p className="correction-final-grade">Nota final: {currentDelivery.nota} / {(currentDelivery.preguntas ?? []).reduce((sum, question) => sum + Number(question.puntajeMaximo), 0)}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!corrected && <div className="correction-actions"><span className="correction-save-state" role="status">{error ? 'Guardado no confirmado' : dirty ? 'Cambios pendientes de guardar' : 'Avance guardado'}</span><button type="button" className="secondary-action" onClick={exit} disabled={saving}>{saving ? 'Guardando…' : 'Salir de corrección'}</button><button type="button" className="primary-action button-action" onClick={requestFinish} disabled={saving || !correction.length}>Finalizar corrección</button></div>}
      {corrected && <Link className="secondary-action dashboard-link" to={backPath}>Volver al listado</Link>}
    </div>}
    {confirmation && <ConfirmDialog titleId="finish-correction-title" title="Estás por finalizar la corrección" actions={<><button type="button" className="secondary-action" onClick={() => setConfirmation(null)} disabled={saving}>Cancelar</button><button type="button" className="primary-action button-action" onClick={confirmFinish} disabled={saving}>{saving ? 'Finalizando…' : 'Finalizar'}</button></>}><p>Alumno: {currentDelivery.nombreAlumno} {currentDelivery.apellidoAlumno}<br />Legajo: {currentDelivery.legajoAlumno}<br />Tema: {currentDelivery.tema?.nombreTema}</p><strong className={`correction-confirm-score ${correctionTone(confirmation.total)}`}>Puntaje: {confirmation.total} / {(currentDelivery.preguntas ?? []).reduce((sum, question) => sum + Number(question.puntajeMaximo), 0)}</strong><p>Al finalizar, la nota se publicará inmediatamente en el panel del alumno.</p></ConfirmDialog>}
  </TeacherShell>
}
