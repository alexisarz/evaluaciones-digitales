import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../features/auth/useAuth'
import { archiveTeacherExam, deleteTeacherExam, loadTeacherExams, selectTeacherCourses, selectTeacherError, selectTeacherExamCounts, selectTeacherLoading, selectVisibleTeacherExams } from '../features/teacherExams/teacherExamsSlice'
import StatCard from '../shared/components/StatCard'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import { isExamArchivable } from '../features/teacherExams/examRules'
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
  const courses = useSelector(selectTeacherCourses)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const visibleExams = useSelector((state) => selectVisibleTeacherExams(state, selectedCourse, now, archived))
  const counts = useSelector((state) => selectTeacherExamCounts(state, selectedCourse, now, archived))

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const request = dispatch(loadTeacherExams(user.legajo))
    return () => request.abort()
  }, [dispatch, user.legajo])
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
    } catch (caught) {
      setActionError(caught.message || 'No se pudo archivar el examen. Intentá nuevamente.')
    } finally { setArchivingId(null) }
  }

  return <TeacherShell>
    <section className="dashboard-heading"><div><h1>{archived ? 'Exámenes archivados' : 'Mis exámenes'}</h1><p>{archived ? 'Consultá los exámenes finalizados que archivaste.' : 'Creá, publicá, monitoreá y corregí los exámenes de tus cursos.'}</p><label className="course-filter">Curso <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}><option value="">Todos mis cursos</option>{courses.map((course) => <option key={course.id} value={course.idCurso ?? course.id}>{course.idCurso ?? course.id} · {course.materia}</option>)}</select></label>{courses.length === 0 && <small className="course-help">No tenés cursos asignados. Contactá a la administración.</small>}</div><div className="dashboard-heading-actions">{archived ? <Link className="secondary-action dashboard-link" to="/profesor/misExamenes">← Mis exámenes</Link> : <><Link className="secondary-action dashboard-link" to="/profesor/examenesArchivados">Ver archivados</Link><Link className="primary-action" to="/profesor/nuevoExamen">+ Nuevo examen</Link></>}</div></section>
    {!archived && <section className="exam-stats"><StatCard value={counts.en_curso} label="En curso ahora" /><StatCard value={counts.programado} label="Programados / reprogramados" /><StatCard value={counts.finalizado} label="Finalizados" /><StatCard value={counts.para_corregir} label="Para corregir" /><StatCard value={counts.borrador} label="Borradores" /></section>}
    <section className="exam-table-card">
      {loading && <p className="table-message">Cargando exámenes…</p>}
      {loadError && <p className="error table-message">{loadError}</p>}
      {actionError && <p className="error table-message" role="alert">{actionError}</p>}
      {!loading && !loadError && visibleExams.length === 0 && <p className="table-message">{archived ? 'No hay exámenes archivados para el curso seleccionado.' : 'No hay exámenes para el curso seleccionado.'}</p>}
      {!loading && !loadError && visibleExams.length > 0 && <div className="table-scroll"><table><thead><tr><th>Examen</th><th>Curso</th><th>Materia</th><th>Fecha y hora</th><th>Duración</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{visibleExams.map((exam) => <tr key={exam.id}><td><strong>{exam.nombre}</strong></td><td>{exam.cursoCodigo ?? 'Sin curso'}</td><td>{exam.materia}</td><td>{displayDate(exam.fechaInicio)}</td><td>{exam.duracionMinutos ? `${exam.duracionMinutos} min` : '—'}</td><td><span className={`status-pill ${exam.estadoVisible}`}>{labels[exam.estadoVisible] ?? exam.estadoVisible}</span></td><td className="exam-actions">{archived ? <span>Archivado</span> : <>{canEdit(exam) && <><button className="text-action" type="button" onClick={() => navigate(`/profesor/editarExamen?id=${exam.id}`)}>{actions[exam.estado]}</button><button className="delete-action" type="button" onClick={() => setExamToDelete(exam)} aria-label={`Borrar ${exam.nombre}`} title="Borrar examen">🗑</button></>}{isExamArchivable(exam, now) && <button className="text-action" type="button" disabled={archivingId === exam.id} onClick={() => archive(exam)}>{archivingId === exam.id ? 'Archivando…' : 'Archivar'}</button>}{!canEdit(exam) && !isExamArchivable(exam, now) && '—'}</>}</td></tr>)}</tbody></table></div>}
    </section>
    {examToDelete && <ConfirmDialog titleId="delete-title" title={`¿Borrar examen ${examToDelete.nombre}?`} actions={<><button className="secondary-action" type="button" onClick={() => setExamToDelete(null)} disabled={deleting}>Cancelar</button><button className="danger-action" type="button" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Borrando…' : 'Borrar'}</button></>}><p>Esta acción eliminará el examen del listado y de la base de datos.</p></ConfirmDialog>}
  </TeacherShell>
}
