import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../features/auth/useAuth'
import { archiveTeacherExam, deleteTeacherExam, loadTeacherExams, moveTeacherExamsToFinalArchive, selectFilteredTeacherExams, selectTeacherCourses, selectTeacherDeliveryCounts, selectTeacherError, selectTeacherExamCounts, selectTeacherLoading, selectVisibleTeacherExams, subscribeTeacherDeliveryCounts } from '../features/teacherExams/teacherExamsSlice'
import StatCard from '../shared/components/StatCard'
import ExamDeliveryCount from '../shared/components/ExamDeliveryCount'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import { isExamArchivable } from '../features/teacherExams/examRules'
import ArchiveExamButton from '../features/teacherExams/ArchiveExamButton'
import useBulkArchive from '../features/teacherExams/useBulkArchive'
import { BulkArchiveConfirmation, BulkArchiveToolbar } from '../features/teacherExams/BulkArchiveControls'
import { isExamEditable } from '../utils/examWindow'

const labels = { borrador: 'Borrador', programado: 'Programado', reprogramado: 'Reprogramado', en_curso: 'En curso', finalizado: 'Finalizado', para_corregir: 'Para corregir', cerrado: 'Cerrado' }
const actions = { borrador: 'Continuar', programado: 'Editar', reprogramado: 'Editar' }
const displayDate = (timestamp) => timestamp && !Number.isNaN(Date.parse(timestamp)) ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp)) : 'Sin fecha'

export default function TeacherExamsPage({ archived = false }) {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loading = useSelector(selectTeacherLoading)
  const loadError = useSelector(selectTeacherError)
  const [examToDelete, setExamToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [archivingId, setArchivingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [pendingRemoval, setPendingRemoval] = useState(null)
  const [moving, setMoving] = useState(false)
  const courses = useSelector(selectTeacherCourses)
  const deliveryCounts = useSelector(selectTeacherDeliveryCounts)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState('todos')
  const [now, setNow] = useState(() => Date.now())
  const visibleExams = useSelector((state) => selectVisibleTeacherExams(state, selectedCourse, now, archived))
  const filteredExams = useSelector((state) => selectFilteredTeacherExams(state, selectedCourse, now, archived, search, searchField))
  const counts = useSelector((state) => selectTeacherExamCounts(state, selectedCourse, now, archived))
  const visibleIds = filteredExams.map((exam) => exam.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
  const eligibleArchiveIds = archived ? [] : filteredExams.filter((exam) => isExamArchivable(exam, now)).map((exam) => exam.id)
  const bulkArchive = useBulkArchive(user.legajo, eligibleArchiveIds)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const request = dispatch(loadTeacherExams(user.legajo))
    return () => request.abort()
  }, [dispatch, user.legajo])
  useEffect(() => subscribeTeacherDeliveryCounts(dispatch, user.legajo), [dispatch, user.legajo])
  const canEdit = (exam) => isExamEditable(exam, now) && !exam.archivado
  const confirmDelete = async () => {
    if (!examToDelete) return
    setDeleting(true)
    try {
      await dispatch(deleteTeacherExam({ id: examToDelete.id, legajoProfe: user.legajo })).unwrap()
      setExamToDelete(null)
    } catch {
      setActionError('No se pudo borrar el examen. Intentá nuevamente.')
    } finally { setDeleting(false) }
  }

  const archive = async (exam) => {
    setArchivingId(exam.id)
    setActionError('')
    try {
      await dispatch(archiveTeacherExam({ id: exam.id, legajoProfe: user.legajo })).unwrap()
      bulkArchive.remove(exam.id)
    } catch (caught) {
      setActionError(caught.message || 'No se pudo archivar el examen. Intentá nuevamente.')
    } finally { setArchivingId(null) }
  }

  const toggleSelected = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])])
  }

  const confirmFinalRemoval = async () => {
    if (!pendingRemoval) return
    setMoving(true)
    setActionError('')
    setActionSuccess('')
    try {
      await dispatch(moveTeacherExamsToFinalArchive({ ids: pendingRemoval.ids, legajoProfe: user.legajo })).unwrap()
      setSelectedIds((current) => current.filter((id) => !pendingRemoval.ids.includes(id)))
      setActionSuccess(`${pendingRemoval.ids.length} examen${pendingRemoval.ids.length === 1 ? '' : 'es'} trasladado${pendingRemoval.ids.length === 1 ? '' : 's'} a archivos definitivos. Las entregas y notas se conservaron.`)
      setPendingRemoval(null)
    } catch (caught) {
      setActionError(caught.message || 'No se pudieron trasladar los exámenes. Intentá nuevamente.')
      setPendingRemoval(null)
    } finally { setMoving(false) }
  }

  return <TeacherShell>
    <section className="dashboard-heading"><div><h1>{archived ? 'Exámenes archivados' : 'Mis exámenes'}</h1><p>{archived ? 'Consultá los exámenes finalizados que archivaste.' : 'Creá, publicá, monitoreá y corregí los exámenes de tus cursos.'}</p><label className="course-filter">Curso <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}><option value="">Todos mis cursos</option>{courses.map((course) => <option key={course.id} value={course.idCurso ?? course.id}>{course.idCurso ?? course.id} · {course.materia}</option>)}</select></label>{courses.length === 0 && <small className="course-help">No tenés cursos asignados. Contactá a la administración.</small>}</div><div className="dashboard-heading-actions">{archived ? <Link className="secondary-action dashboard-link" to="/profesor/misExamenes">← Mis exámenes</Link> : <><Link className="secondary-action dashboard-link" to="/profesor/examenesArchivados">Ver archivados</Link><Link className="primary-action" to="/profesor/nuevoExamen">+ Nuevo examen</Link></>}</div></section>
    {!archived && <section className="exam-stats"><StatCard value={counts.en_curso} label="En curso ahora" /><StatCard value={counts.programado} label="Programados / reprogramados" /><StatCard value={counts.finalizado} label="Finalizados" /><StatCard value={counts.para_corregir} label="Para corregir" /><StatCard value={counts.borrador} label="Borradores" /></section>}
    <section className="correction-filters" aria-label="Buscar exámenes"><label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, curso, materia, fecha o estado" /></label><label>Buscar por<select value={searchField} onChange={(event) => setSearchField(event.target.value)}><option value="todos">Todos los campos</option><option value="nombre">Examen</option><option value="curso">Curso</option><option value="materia">Materia</option><option value="fecha">Fecha y hora</option><option value="duracion">Duración</option><option value="estado">Estado</option></select></label><span role="status">{filteredExams.length} de {visibleExams.length} exámenes</span></section>
    {archived ? <section className="archive-selection-bar" aria-label="Acciones de exámenes archivados"><span>{selectedIds.length} seleccionados{selectedIds.length > 100 && ' · máximo 100 por operación'}</span>{selectedIds.length > 0 && <button className="text-action" type="button" onClick={() => setSelectedIds([])}>Limpiar selección</button>}<button className="danger-action" type="button" disabled={selectedIds.length === 0 || selectedIds.length > 100 || moving} onClick={() => setPendingRemoval({ ids: [...selectedIds], names: [] })}>Eliminar seleccionados</button></section> : <BulkArchiveToolbar selectedCount={bulkArchive.selectedIds.length} busy={bulkArchive.busy} onClear={bulkArchive.clear} onArchive={bulkArchive.requestArchive} />}
    <section className="exam-table-card">
      {loading && <p className="table-message">Cargando exámenes…</p>}
      {loadError && <p className="error table-message">{loadError}</p>}
      {actionError && <p className="error table-message" role="alert">{actionError}</p>}
      {bulkArchive.error && <p className="error table-message" role="alert">{bulkArchive.error}</p>}
      {actionSuccess && <p className="archive-success table-message" role="status">{actionSuccess}</p>}
      {bulkArchive.successCount > 0 && <p className="archive-success table-message" role="status">{bulkArchive.successCount === 1 ? 'Se archivó 1 examen.' : `Se archivaron ${bulkArchive.successCount} exámenes.`} Podés consultarlos en Exámenes archivados.</p>}
      {!loading && !loadError && filteredExams.length === 0 && <p className="table-message">{visibleExams.length > 0 ? 'No hay exámenes que coincidan con la búsqueda.' : archived ? 'No hay exámenes archivados para el curso seleccionado.' : 'No hay exámenes para el curso seleccionado.'}</p>}
      {!loading && !loadError && filteredExams.length > 0 && <div className="table-scroll"><table><thead><tr><th className="archive-select-cell"><input type="checkbox" aria-label={archived ? 'Seleccionar todos los exámenes visibles' : 'Seleccionar todos los exámenes finalizados visibles'} checked={archived ? allVisibleSelected : bulkArchive.allVisibleSelected} disabled={!archived && (eligibleArchiveIds.length === 0 || bulkArchive.busy)} onChange={archived ? toggleAllVisible : bulkArchive.toggleAllVisible} /></th><th>Examen</th><th>Curso</th><th>Materia</th><th>Fecha y hora</th><th>Duración</th><th>Estado</th><th className="exam-actions-heading">Acción</th></tr></thead><tbody>{filteredExams.map((exam) => <tr key={exam.id}>
        <td className="archive-select-cell">{archived ? <input type="checkbox" aria-label={`Seleccionar ${exam.nombre}`} checked={selectedIds.includes(exam.id)} onChange={() => toggleSelected(exam.id)} /> : <input type="checkbox" aria-label={`Seleccionar ${exam.nombre} para archivar`} title={isExamArchivable(exam, now) ? `Seleccionar ${exam.nombre}` : 'Sólo se pueden archivar exámenes finalizados'} checked={bulkArchive.selectedIds.includes(exam.id)} disabled={!isExamArchivable(exam, now) || bulkArchive.busy} onChange={() => bulkArchive.toggle(exam.id)} />}</td>
        <td><strong>{exam.nombre}</strong> <ExamDeliveryCount count={deliveryCounts[exam.id]} /></td><td>{exam.cursoCodigo ?? 'Sin curso'}</td><td>{exam.materia}</td><td>{displayDate(exam.fechaInicio)}</td><td>{exam.duracionMinutos ? `${exam.duracionMinutos} min` : '—'}</td><td><span className={`status-pill ${exam.estadoVisible}`}>{labels[exam.estadoVisible] ?? exam.estadoVisible}</span></td>
        <td className="exam-actions">
          {canEdit(exam) && <><button className="text-action" type="button" onClick={() => navigate(`/profesor/editarExamen?id=${exam.id}`)}>{actions[exam.estado]}</button><button className="delete-action" type="button" onClick={() => setExamToDelete(exam)} aria-label={`Borrar ${exam.nombre}`} title="Borrar examen">🗑</button></>}
          {exam.estadoVisible === 'finalizado' && courses.some((course) => (course.idCurso ?? course.id) === exam.cursoCodigo) && <Link className="text-action" to={`/profesor/corregirExamen?id=${encodeURIComponent(exam.id)}`}>Corregir</Link>}
          {!archived && isExamArchivable(exam, now) && <ArchiveExamButton exam={exam} busy={archivingId === exam.id || bulkArchive.busy} onArchive={archive} />}
          {archived && <><button className="delete-action" type="button" onClick={() => setPendingRemoval({ ids: [exam.id], names: [exam.nombre] })} aria-label={`Eliminar ${exam.nombre} de archivados`} title="Eliminar de archivados">🗑</button><span className="archived-hint">Archivado</span></>}
          <Link className="text-action" to={`/profesor/corregirExamen?id=${encodeURIComponent(exam.id)}&tab=alumnos`}>Ver estados</Link>
        </td>
      </tr>)}</tbody></table></div>}
    </section>
    {examToDelete && <ConfirmDialog titleId="delete-title" title={`¿Borrar examen ${examToDelete.nombre}?`} actions={<><button className="secondary-action" type="button" onClick={() => setExamToDelete(null)} disabled={deleting}>Cancelar</button><button className="danger-action" type="button" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Borrando…' : 'Borrar'}</button></>}><p>Esta acción eliminará el examen del listado y de la base de datos.</p></ConfirmDialog>}
    {pendingRemoval && <ConfirmDialog titleId="final-archive-title" title={pendingRemoval.names[0] ? `¿Eliminar ${pendingRemoval.names[0]} de archivados?` : `¿Eliminar ${pendingRemoval.ids.length} examen${pendingRemoval.ids.length === 1 ? '' : 'es'} de archivados?`} actions={<><button className="secondary-action" type="button" onClick={() => setPendingRemoval(null)} disabled={moving}>Cancelar</button><button className="danger-action" type="button" onClick={confirmFinalRemoval} disabled={moving}>{moving ? 'Trasladando…' : 'Eliminar'}</button></>}><p>Se trasladarán a archivos definitivos y desaparecerán de las vistas del profesor. Las entregas y notas de los alumnos se conservarán. Los exámenes con intentos abiertos o correcciones pendientes no se pueden trasladar.</p></ConfirmDialog>}
    <BulkArchiveConfirmation count={bulkArchive.pendingIds?.length ?? 0} busy={bulkArchive.busy} onCancel={bulkArchive.cancelArchive} onConfirm={bulkArchive.confirmArchive} />
  </TeacherShell>
}
