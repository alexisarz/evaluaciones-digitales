import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../features/auth/useAuth'
import { loadTeacherCourses, selectFilteredMyCourses, selectMyCourses, selectMyCoursesError, selectMyCoursesLoading, subscribeTeacherCourseCounts } from '../features/teacherCourses/teacherCoursesSlice'

export default function TeacherCoursesPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [search, setSearch] = useState('')
  const [liveError, setLiveError] = useState('')
  const allCourses = useSelector(selectMyCourses)
  const courseCodes = allCourses.map((course) => course.idCurso ?? course.id).filter(Boolean).join('\u0000')
  const courses = useSelector((state) => selectFilteredMyCourses(state, search))
  const loading = useSelector(selectMyCoursesLoading)
  const error = useSelector(selectMyCoursesError)

  useEffect(() => {
    const request = dispatch(loadTeacherCourses(user.legajo))
    return () => request.abort()
  }, [dispatch, user.legajo])

  useEffect(() => {
    if (!courseCodes) return undefined
    return subscribeTeacherCourseCounts(dispatch, courseCodes.split('\u0000'),
      () => setLiveError('No se pudo actualizar la cantidad de alumnos. Recargá la página.'))
  }, [dispatch, courseCodes])

  return <TeacherShell>
    <section className="dashboard-heading"><div><h1>Mis cursos</h1><p>Consultá tus materias y los alumnos inscriptos.</p></div></section>
    <label className="teacher-course-search">Buscar curso<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Materia o código" /></label>
    {loading && <p className="table-message" role="status">Cargando cursos…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {liveError && <p className="error" role="alert">{liveError}</p>}
    {!loading && !error && courses.length === 0 && <p className="table-message">{search ? 'No hay cursos que coincidan con la búsqueda.' : 'Todavía no tenés cursos asignados.'}</p>}
    {!loading && !error && courses.length > 0 && <section className="teacher-course-grid" aria-label="Cursos asignados">
      {courses.map((course) => {
        const code = course.idCurso ?? course.id
        return <article className="teacher-course-card" key={code}>
          <p className="teacher-course-code">{code}</p>
          <h2>{course.materia || 'Materia sin nombre'}</h2>
          <p>{course.cantidadAlumnos} {course.cantidadAlumnos === 1 ? 'alumno inscripto' : 'alumnos inscriptos'}</p>
          <Link className="primary-action" to={`/profesor/misCursos/curso?id=${encodeURIComponent(code)}`}>Ver curso</Link>
        </article>
      })}
    </section>}
  </TeacherShell>
}
