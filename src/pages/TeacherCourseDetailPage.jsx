import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../features/auth/useAuth'
import { loadTeacherCourseDetail, selectFilteredMyCourseStudents, selectMyCourseDetail, selectMyCourseDetailError, selectMyCourseDetailLoading, selectMyCourseGradebook, subscribeTeacherCourseAttempts, subscribeTeacherCourseStudents } from '../features/teacherCourses/teacherCoursesSlice'

function GradeCell({ grade, pending = false }) {
  if (typeof grade === 'number') return grade.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return pending ? <span className="course-grade-pending">Pendiente</span> : '—'
}

export default function TeacherCourseDetailPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [params] = useSearchParams()
  const courseCode = params.get('id')
  const [search, setSearch] = useState('')
  const [liveError, setLiveError] = useState('')
  const detail = useSelector(selectMyCourseDetail)
  const gradebook = useSelector(selectMyCourseGradebook)
  const rows = useSelector((state) => selectFilteredMyCourseStudents(state, search))
  const loading = useSelector(selectMyCourseDetailLoading)
  const error = useSelector(selectMyCourseDetailError)

  useEffect(() => {
    if (!courseCode) return undefined
    setLiveError('')
    const request = dispatch(loadTeacherCourseDetail({ courseCode, legajoProfe: user.legajo }))
    return () => request.abort()
  }, [dispatch, courseCode, user.legajo])

  useEffect(() => {
    if (detail?.course?.id !== courseCode) return undefined
    return subscribeTeacherCourseStudents(dispatch, courseCode,
      () => setLiveError('No se pudo actualizar el listado de alumnos. Recargá la página.'))
  }, [dispatch, courseCode, detail?.course?.id])

  useEffect(() => {
    if (detail?.course?.id !== courseCode) return undefined
    return subscribeTeacherCourseAttempts(dispatch, courseCode, user.legajo, detail.students,
      () => setLiveError('No se pudieron actualizar las notas en tiempo real. Recargá la página.'))
  }, [dispatch, courseCode, user.legajo, detail?.course?.id, detail?.students])

  return <TeacherShell>
    <section className="new-exam-header"><div><Link className="secondary-action dashboard-link" to="/profesor/misCursos">← Volver a mis cursos</Link><h1>{detail?.course?.materia ?? 'Detalle del curso'}</h1><p className="teacher-course-subtitle">{detail?.course?.idCurso ?? courseCode ?? ''}</p></div></section>
    {!courseCode && <p className="error" role="alert">Falta el código del curso.</p>}
    {loading && <p className="table-message" role="status">Cargando alumnos y notas…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {liveError && <p className="error" role="alert">{liveError}</p>}
    {!loading && !error && detail?.course?.id === courseCode && <>
      <div className="teacher-course-detail-tools"><label className="teacher-course-search">Buscar alumno<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, apellido o legajo" /></label><span role="status">{rows.length} de {gradebook.rows.length} alumnos</span></div>
      <section className="exam-table-card"><div className="table-scroll"><table className="teacher-course-table"><thead><tr><th>Alumno</th><th>Legajo</th>{gradebook.columns.map((column) => <th key={column.key}>{column.title}</th>)}<th>Promedio</th></tr></thead><tbody>{rows.map((row) => <tr key={row.legajo}><td><strong>{row.nombreCompleto}</strong></td><td>{row.legajo}</td>{gradebook.columns.map((column) => <td key={column.key}><GradeCell grade={row.grades[column.key]} pending={row.pending[column.key]} /></td>)}<td><GradeCell grade={row.promedio} /></td></tr>)}</tbody></table></div>{rows.length === 0 && <p className="table-message">{gradebook.rows.length ? 'No hay alumnos que coincidan con la búsqueda.' : 'No hay alumnos inscriptos en este curso.'}</p>}</section>
    </>}
  </TeacherShell>
}
