import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../features/auth/useAuth'
import { archiveTeacherExam, loadTeacherExams, selectFilteredFinalizedTeacherExams, selectFinalizedTeacherExams, selectTeacherCourses, selectTeacherDeliveryCounts, selectTeacherError, selectTeacherLoading, subscribeTeacherDeliveryCounts } from '../features/teacherExams/teacherExamsSlice'
import ArchiveExamButton from '../features/teacherExams/ArchiveExamButton'
import useBulkArchive from '../features/teacherExams/useBulkArchive'
import { BulkArchiveConfirmation, BulkArchiveToolbar } from '../features/teacherExams/BulkArchiveControls'
import ExamDeliveryCount from '../shared/components/ExamDeliveryCount'

export default function CorrectionsPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [courseCode, setCourseCode] = useState('')
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState('todos')
  const [now, setNow] = useState(() => Date.now())
  const [archivingId, setArchivingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [archivedName, setArchivedName] = useState('')
  const courses = useSelector(selectTeacherCourses)
  const exams = useSelector((state) => selectFinalizedTeacherExams(state, courseCode, now))
  const filteredExams = useSelector((state) => selectFilteredFinalizedTeacherExams(state, courseCode, now, search, searchField))
  const bulkArchive = useBulkArchive(user.legajo, filteredExams.map((exam) => exam.id))
  const deliveryCounts = useSelector(selectTeacherDeliveryCounts)
  const loading = useSelector(selectTeacherLoading)
  const error = useSelector(selectTeacherError)

  useEffect(() => {
    const request = dispatch(loadTeacherExams(user.legajo))
    return () => request.abort()
  }, [dispatch, user.legajo])
  useEffect(() => subscribeTeacherDeliveryCounts(dispatch, user.legajo), [dispatch, user.legajo])
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const archive = async (exam) => {
    setArchivingId(exam.id)
    setActionError('')
    setArchivedName('')
    try {
      await dispatch(archiveTeacherExam({ id: exam.id, legajoProfe: user.legajo })).unwrap()
      bulkArchive.remove(exam.id)
      setArchivedName(exam.nombre)
    } catch (caught) {
      setActionError(caught.message || 'No se pudo archivar el examen. Intentá nuevamente.')
    } finally { setArchivingId(null) }
  }

  return <TeacherShell>
    <section className="dashboard-heading"><div><h1>Correcciones</h1><p>Exámenes finalizados de tus cursos, listos para revisar por alumno.</p><label className="course-filter">Curso<select value={courseCode} onChange={(event) => setCourseCode(event.target.value)}><option value="">Todos mis cursos</option>{courses.map((course) => <option key={course.id} value={course.idCurso ?? course.id}>{course.idCurso ?? course.id} · {course.materia}</option>)}</select></label></div><div className="dashboard-heading-actions"><Link className="secondary-action dashboard-link" to="/profesor/examenesArchivados">Ver archivados</Link></div></section>
    <section className="correction-filters" aria-label="Buscar exámenes para corregir"><label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Examen, curso, materia o comisión" /></label><label>Buscar por<select value={searchField} onChange={(event) => setSearchField(event.target.value)}><option value="todos">Todos los campos</option><option value="nombre">Examen</option><option value="curso">Curso</option><option value="materia">Materia</option><option value="comision">Comisión</option></select></label><span role="status">{filteredExams.length} de {exams.length} exámenes</span></section>
    <BulkArchiveToolbar selectedCount={bulkArchive.selectedIds.length} busy={bulkArchive.busy} onClear={bulkArchive.clear} onArchive={bulkArchive.requestArchive} />
    <section className="exam-table-card">
      {loading && <p className="table-message">Cargando exámenes…</p>}
      {error && <p className="error table-message" role="alert">{error}</p>}
      {actionError && <p className="error table-message" role="alert">{actionError}</p>}
      {bulkArchive.error && <p className="error table-message" role="alert">{bulkArchive.error}</p>}
      {archivedName && <p className="archive-success table-message" role="status">{archivedName} se archivó. Podés consultarlo en Exámenes archivados.</p>}
      {bulkArchive.successCount > 0 && <p className="archive-success table-message" role="status">{bulkArchive.successCount === 1 ? 'Se archivó 1 examen.' : `Se archivaron ${bulkArchive.successCount} exámenes.`} Podés consultarlos en Exámenes archivados.</p>}
      {!loading && !error && filteredExams.length === 0 && <p className="table-message">{exams.length > 0 ? 'No hay exámenes que coincidan con la búsqueda.' : 'No hay exámenes finalizados para el curso seleccionado.'}</p>}
      {!loading && !error && filteredExams.length > 0 && <div className="table-scroll"><table><thead><tr><th className="archive-select-cell"><input type="checkbox" aria-label="Seleccionar todos los exámenes visibles para archivar" checked={bulkArchive.allVisibleSelected} disabled={bulkArchive.busy} onChange={bulkArchive.toggleAllVisible} /></th><th>Examen</th><th>Curso</th><th>Materia</th><th>Comisión</th><th>Acción</th></tr></thead><tbody>{filteredExams.map((exam) => <tr key={exam.id}><td className="archive-select-cell"><input type="checkbox" aria-label={`Seleccionar ${exam.nombre} para archivar`} checked={bulkArchive.selectedIds.includes(exam.id)} disabled={bulkArchive.busy} onChange={() => bulkArchive.toggle(exam.id)} /></td><td><strong>{exam.nombre}</strong> <ExamDeliveryCount count={deliveryCounts[exam.id]} /></td><td>{exam.cursoCodigo ?? '—'}</td><td>{exam.materia ?? '—'}</td><td>{exam.comisionId || '—'}</td><td className="exam-actions"><Link className="text-action" to={`/profesor/corregirExamen?id=${encodeURIComponent(exam.id)}`}>Corregir</Link><ArchiveExamButton exam={exam} busy={archivingId === exam.id || bulkArchive.busy} onArchive={archive} /></td></tr>)}</tbody></table></div>}
    </section>
    <BulkArchiveConfirmation count={bulkArchive.pendingIds?.length ?? 0} busy={bulkArchive.busy} onCancel={bulkArchive.cancelArchive} onConfirm={bulkArchive.confirmArchive} />
  </TeacherShell>
}
