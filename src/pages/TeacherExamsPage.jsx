import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../context/AuthContext'
import { borrarExamen, obtenerExamenesPorProfesor } from '../services/examsService'
import { obtenerCursosPorProfesor } from '../services/coursesService'
import { getEffectiveExamStatus, isExamEditable } from '../utils/examWindow'

const labels = { borrador: 'Borrador', programado: 'Programado', reprogramado: 'Reprogramado', en_curso: 'En curso', finalizado: 'Finalizado', para_corregir: 'Para corregir', cerrado: 'Cerrado' }
const actions = { borrador: 'Continuar', programado: 'Editar', reprogramado: 'Editar' }
const displayDate = (timestamp) => timestamp?.toDate ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(timestamp.toDate()) : 'Sin fecha'

export default function TeacherExamsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [examToDelete, setExamToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let mounted = true
    obtenerExamenesPorProfesor(user.legajo)
      .then((data) => mounted && setExams(data))
      .catch(() => mounted && setError('No se pudieron cargar tus exámenes. Intentá nuevamente.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [user.legajo])

  useEffect(() => {
    let mounted = true
    obtenerCursosPorProfesor(user.legajo).then((data) => mounted && setCourses(data)).catch(() => mounted && setError('No se pudieron cargar tus cursos asignados.'))
    return () => { mounted = false }
  }, [user.legajo])

  const visibleExams = useMemo(() => (selectedCourse ? exams.filter((exam) => exam.cursoCodigo === selectedCourse) : exams)
    .map((exam) => ({ ...exam, estadoVisible: getEffectiveExamStatus(exam, now) })), [exams, selectedCourse, now])
  const counts = useMemo(() => ({
    en_curso: visibleExams.filter((exam) => exam.estadoVisible === 'en_curso').length,
    programado: visibleExams.filter((exam) => ['programado', 'reprogramado'].includes(exam.estadoVisible)).length,
    finalizado: visibleExams.filter((exam) => exam.estadoVisible === 'finalizado').length,
    para_corregir: visibleExams.filter((exam) => exam.estadoVisible === 'para_corregir').length,
    borrador: visibleExams.filter((exam) => exam.estadoVisible === 'borrador').length,
  }), [visibleExams])
  const canEdit = (exam) => isExamEditable(exam, now)
  const confirmDelete = async () => {
    if (!examToDelete) return
    setDeleting(true)
    try {
      await borrarExamen(examToDelete.id)
      setExams((current) => current.filter((exam) => exam.id !== examToDelete.id))
      setExamToDelete(null)
    } catch {
      setError('No se pudo borrar el examen. Intentá nuevamente.')
    } finally { setDeleting(false) }
  }

  return <TeacherShell>
    <section className="dashboard-heading"><div><h1>Mis exámenes</h1><p>Creá, publicá, monitoreá y corregí los exámenes de tus cursos.</p><label className="course-filter">Curso <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}><option value="">Todos mis cursos</option>{courses.map((course) => <option key={course.id} value={course.idCurso ?? course.id}>{course.idCurso ?? course.id} · {course.materia}</option>)}</select></label>{courses.length === 0 && <small className="course-help">No tenés cursos asignados. Contactá a la administración.</small>}</div><Link className="primary-action" to="/profesor/nuevoExamen">+ Nuevo examen</Link></section>
    <section className="exam-stats"><Stat value={counts.en_curso} label="En curso ahora" /><Stat value={counts.programado} label="Programados / reprogramados" /><Stat value={counts.finalizado} label="Finalizados" /><Stat value={counts.para_corregir} label="Para corregir" /><Stat value={counts.borrador} label="Borradores" /></section>
    <section className="exam-table-card">
      {loading && <p className="table-message">Cargando exámenes…</p>}
      {error && <p className="error table-message">{error}</p>}
      {!loading && !error && visibleExams.length === 0 && <p className="table-message">No hay exámenes para el curso seleccionado.</p>}
      {!loading && !error && visibleExams.length > 0 && <div className="table-scroll"><table><thead><tr><th>Examen</th><th>Curso</th><th>Materia</th><th>Fecha y hora</th><th>Duración</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{visibleExams.map((exam) => <tr key={exam.id}><td><strong>{exam.nombre}</strong></td><td>{exam.cursoCodigo ?? 'Sin curso'}</td><td>{exam.materia}</td><td>{displayDate(exam.fechaInicio)}</td><td>{exam.duracionMinutos ? `${exam.duracionMinutos} min` : '—'}</td><td><span className={`status-pill ${exam.estadoVisible}`}>{labels[exam.estadoVisible] ?? exam.estadoVisible}</span></td><td className="exam-actions">{canEdit(exam) && <button className="text-action" type="button" onClick={() => navigate(`/profesor/editarExamen?id=${exam.id}`)}>{actions[exam.estado]}</button>}<button className="delete-action" type="button" onClick={() => setExamToDelete(exam)} aria-label={`Borrar ${exam.nombre}`} title="Borrar examen">🗑</button></td></tr>)}</tbody></table></div>}
    </section>
    {examToDelete && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">¿Borrar examen {examToDelete.nombre}?</h2><p>Esta acción eliminará el examen del listado y de la base de datos.</p><div><button className="secondary-action" type="button" onClick={() => setExamToDelete(null)} disabled={deleting}>Cancelar</button><button className="danger-action" type="button" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Borrando…' : 'Borrar'}</button></div></section></div>}
  </TeacherShell>
}

function Stat({ value, label }) { return <article className="stat"><strong>{value}</strong><span>{label}</span></article> }
