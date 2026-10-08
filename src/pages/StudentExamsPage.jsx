import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { obtenerCursosPorCodigos } from '../services/coursesService'
import { obtenerExamenesPorCursos } from '../services/examsService'

export default function StudentExamsPage() {
  const { user, logout } = useAuth()
  const [exams, setExams] = useState([])
  const [courses, setCourses] = useState([])
  const [selectedTopics, setSelectedTopics] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    obtenerCursosPorCodigos(user.cursosActivos ?? []).then(async (assignedCourses) => {
      const data = await obtenerExamenesPorCursos(assignedCourses.map((course) => course.idCurso ?? course.id))
      if (mounted) { setCourses(assignedCourses); setExams(data) }
    }).catch(() => mounted && setError('No se pudieron cargar tus exámenes. Intentá nuevamente.')).finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [user.cursosActivos, user.legajo])

  return <main className="student-page"><header className="student-header"><strong>Evaluación Digital</strong><span>Legajo {user.legajo} · {user.nombre} {user.apellido}</span><button onClick={logout}>Cerrar sesión</button></header><section className="student-content"><h1>Mis exámenes</h1><p>Vas a ver únicamente los exámenes habilitados para tus cursos.</p>{loading && <p>Cargando exámenes…</p>}{error && <p className="error">{error}</p>}{!loading && courses.length === 0 && <p className="notice">No estás asignado/a a ningún curso. Contactá a la administración.</p>}{!loading && courses.length > 0 && exams.length === 0 && <p className="notice">No hay exámenes habilitados para tus cursos.</p>}<div className="student-exams">{exams.map((exam) => <article className="student-exam" key={exam.id}><small>{exam.cursoCodigo} · {exam.materia}</small><h2>{exam.nombre}</h2><p>Duración: <strong>120 minutos</strong></p>{selectedTopics[exam.id] ? <div className="selected-topic" style={{ borderColor: selectedTopics[exam.id].color }}><strong style={{ background: selectedTopics[exam.id].color }}>TEMA: {selectedTopics[exam.id].nombreTema}</strong><p>El tema fue seleccionado y no podrá cambiarse al iniciar el examen.</p></div> : <div><p>Seleccioná tu tema:</p><div className="student-topic-list">{exam.temas?.map((topic) => <button key={topic.nombreTema} type="button" style={{ borderColor: topic.color }} onClick={() => setSelectedTopics((current) => ({ ...current, [exam.id]: topic }))}>{topic.nombreTema}</button>)}</div></div>}</article>)}</div></section></main>
}
