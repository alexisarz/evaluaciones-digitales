import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../features/auth/useAuth'
import { loadTeacherExams, selectFinalizedTeacherExams, selectTeacherCourses, selectTeacherError, selectTeacherLoading } from '../features/teacherExams/teacherExamsSlice'

export default function CorrectionsPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [courseCode, setCourseCode] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const courses = useSelector(selectTeacherCourses)
  const exams = useSelector((state) => selectFinalizedTeacherExams(state, courseCode, now))
  const loading = useSelector(selectTeacherLoading)
  const error = useSelector(selectTeacherError)

  useEffect(() => {
    const request = dispatch(loadTeacherExams(user.legajo))
    return () => request.abort()
  }, [dispatch, user.legajo])
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  return <TeacherShell>
    <section className="dashboard-heading"><div><h1>Correcciones</h1><p>Exámenes finalizados de tus cursos, listos para revisar por alumno.</p><label className="course-filter">Curso<select value={courseCode} onChange={(event) => setCourseCode(event.target.value)}><option value="">Todos mis cursos</option>{courses.map((course) => <option key={course.id} value={course.idCurso ?? course.id}>{course.idCurso ?? course.id} · {course.materia}</option>)}</select></label></div></section>
    <section className="exam-table-card">
      {loading && <p className="table-message">Cargando exámenes…</p>}
      {error && <p className="error table-message" role="alert">{error}</p>}
      {!loading && !error && exams.length === 0 && <p className="table-message">No hay exámenes finalizados para el curso seleccionado.</p>}
      {!loading && !error && exams.length > 0 && <div className="table-scroll"><table><thead><tr><th>Examen</th><th>Curso</th><th>Materia</th><th>Comisión</th><th>Acción</th></tr></thead><tbody>{exams.map((exam) => <tr key={exam.id}><td><strong>{exam.nombre}</strong>{exam.archivado && <small className="archived-hint">Archivado</small>}</td><td>{exam.cursoCodigo ?? '—'}</td><td>{exam.materia ?? '—'}</td><td>{exam.comisionId || '—'}</td><td><Link className="text-action" to={`/profesor/corregirExamen?id=${encodeURIComponent(exam.id)}`}>Corregir</Link></td></tr>)}</tbody></table></div>}
    </section>
  </TeacherShell>
}
