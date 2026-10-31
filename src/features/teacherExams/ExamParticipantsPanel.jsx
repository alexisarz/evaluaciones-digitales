import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import ConfirmDialog from '../../shared/components/ConfirmDialog'
import { getEffectiveExamStatus } from '../../utils/examWindow'
import { createAbsentDelivery, forceFinishExam, loadExamParticipants, selectExamParticipantRows, selectFilteredExamParticipantRows, selectHasOpenExamAttempts, selectParticipantExam, selectParticipantsError, selectParticipantsLoading, selectParticipantsReady, subscribeExamParticipantAttempts, subscribeExamParticipantExam, subscribeExamParticipantStudents } from './examParticipantsSlice'

const statusClass = { '—': 'not-started', 'En curso': 'en_curso', Entregado: 'cerrado', Ausente: 'absent' }

export default function ExamParticipantsPanel({ examId, legajoProfe, allowCorrection = false }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [now, setNow] = useState(() => Date.now())
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [topicName, setTopicName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showFinalize, setShowFinalize] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeSuccess, setFinalizeSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  const exam = useSelector(selectParticipantExam)
  const loading = useSelector(selectParticipantsLoading)
  const attemptsReady = useSelector(selectParticipantsReady)
  const error = useSelector(selectParticipantsError)
  const hasOpenAttempts = useSelector(selectHasOpenExamAttempts)
  const allRows = useSelector((state) => selectExamParticipantRows(state, now))
  const rows = useSelector((state) => selectFilteredExamParticipantRows(state, now, search, status))
  const ready = exam?.id === examId && attemptsReady
  const correctable = allowCorrection && exam && getEffectiveExamStatus(exam, now) === 'finalizado'
  const canForceFinish = allowCorrection && ready && (getEffectiveExamStatus(exam, now) === 'en_curso' ||
    (Boolean(exam.fechaFinForzada) && hasOpenAttempts))

  useEffect(() => {
    if (!examId) return undefined
    const request = dispatch(loadExamParticipants({ examId, legajoProfe }))
    return () => request.abort()
  }, [dispatch, examId, legajoProfe])

  useEffect(() => {
    if (exam?.id !== examId) return undefined
    const stopAttempts = subscribeExamParticipantAttempts(dispatch, examId)
    const stopExam = subscribeExamParticipantExam(dispatch, examId)
    return () => { stopAttempts(); stopExam() }
  }, [dispatch, exam?.id, examId])

  useEffect(() => {
    if (exam?.id !== examId || !exam.cursoCodigo) return undefined
    return subscribeExamParticipantStudents(dispatch, examId, exam.cursoCodigo)
  }, [dispatch, exam?.id, exam?.cursoCodigo, examId])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const beginBlankCorrection = (student) => {
    if (!exam?.temas?.length) return setActionError('Este examen no tiene temas para preparar una entrega en blanco.')
    setSelectedStudent(student)
    setTopicName(exam.temas[0].nombreTema)
    setActionError('')
  }

  const confirmBlankCorrection = async () => {
    if (!selectedStudent || !topicName) return
    setCreating(true)
    setActionError('')
    try {
      const delivery = await dispatch(createAbsentDelivery({ examId, legajoAlumno: selectedStudent.legajo, nombreTema: topicName, legajoProfe })).unwrap()
      setSelectedStudent(null)
      navigate(`/profesor/corregirExamen/examenAlumno?id=${encodeURIComponent(delivery.id)}`)
    } catch (caught) { setActionError(caught.message || 'No se pudo crear la entrega en blanco.') } finally { setCreating(false) }
  }

  const confirmForceFinish = async () => {
    setFinalizing(true)
    setActionError('')
    setFinalizeSuccess('')
    try {
      await dispatch(forceFinishExam({ examId, legajoProfe })).unwrap()
      setFinalizeSuccess('El examen finalizó. Los intentos abiertos se entregaron con las respuestas guardadas.')
      setShowFinalize(false)
    } catch (caught) {
      setActionError(caught.message || 'No se pudo finalizar el examen. Intentá nuevamente.')
      setShowFinalize(false)
    } finally { setFinalizing(false) }
  }

  return <section className="exam-participants-panel" aria-label="Alumnos del examen">
    {canForceFinish && <div className="exam-force-finish"><button type="button" className="danger-action" onClick={() => { setActionError(''); setShowFinalize(true) }}>Finalizar examen</button></div>}
    <div className="correction-filters"><label>Buscar alumno<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, legajo o estado" /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos</option><option value="—">—</option><option value="En curso">En curso</option><option value="Entregado">Entregado</option><option value="Ausente">Ausente</option></select></label>{ready && <span role="status">{rows.length} de {allRows.length} alumnos</span>}</div>
    {loading && <p className="table-message" role="status">Cargando alumnos…</p>}
    {!loading && exam?.id === examId && !attemptsReady && !error && <p className="table-message" role="status">Actualizando estados de entrega…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {actionError && <p className="error" role="alert">{actionError}</p>}
    {finalizeSuccess && <p className="archive-success table-message" role="status">{finalizeSuccess}</p>}
    {ready && <section className="exam-table-card"><div className="table-scroll"><table className="exam-participants-table"><thead><tr><th>Alumno</th><th>Legajo</th><th>Estado de entrega</th>{correctable && <th>Corrección</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.legajo}><td><strong>{row.nombreCompleto}</strong></td><td>{row.legajo}</td><td><span className={`status-pill ${statusClass[row.estadoEntrega]}`}>{row.estadoEntrega}</span></td>{correctable && <td>{row.attempt?.estadoEntrega === 'entregado' ? <Link className="text-action" to={`/profesor/corregirExamen/examenAlumno?id=${encodeURIComponent(row.attempt.id)}`}>{row.attempt.estadoCorreccion === 'corregido' ? 'Ver corrección' : row.attempt.correccionIniciada ? 'Continuar corrección' : 'Corregir'}</Link> : row.estadoEntrega === 'Ausente' && !row.attempt ? <button className="text-action" type="button" onClick={() => beginBlankCorrection(row)}>Corregir en blanco</button> : '—'}</td>}</tr>)}</tbody></table></div>{rows.length === 0 && <p className="table-message">{allRows.length ? 'No hay alumnos que coincidan con la búsqueda.' : 'No hay alumnos inscriptos en el curso de este examen.'}</p>}</section>}
    {selectedStudent && <ConfirmDialog titleId="blank-delivery-title" title="Crear entrega en blanco" actions={<><button type="button" className="secondary-action" onClick={() => setSelectedStudent(null)} disabled={creating}>Cancelar</button><button type="button" className="primary-action button-action" onClick={confirmBlankCorrection} disabled={creating || !topicName}>{creating ? 'Creando…' : 'Crear y corregir'}</button></>}><p>{selectedStudent.nombreCompleto} · Legajo {selectedStudent.legajo} nunca inició el examen. Elegí el tema que se usará para corregir la entrega en blanco.</p><label className="blank-delivery-topic">Tema<select value={topicName} onChange={(event) => setTopicName(event.target.value)}>{exam.temas.map((topic) => <option key={topic.nombreTema} value={topic.nombreTema}>{topic.nombreTema}</option>)}</select></label>{actionError && <p className="error" role="alert">{actionError}</p>}</ConfirmDialog>}
    {showFinalize && <ConfirmDialog titleId="force-finish-title" title="Finalizar examen" actions={<><button type="button" className="secondary-action" onClick={() => setShowFinalize(false)} disabled={finalizing}>Cancelar</button><button type="button" className="danger-action" onClick={confirmForceFinish} disabled={finalizing}>{finalizing ? 'Finalizando…' : 'Finalizar'}</button></>}><p>Se finalizarán los exámenes, incluso los que no hayan sido terminados por los alumnos. ¿Estás seguro/a de finalizar?</p></ConfirmDialog>}
  </section>
}
