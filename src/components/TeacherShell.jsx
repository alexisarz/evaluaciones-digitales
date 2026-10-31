import { NavLink } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export default function TeacherShell({ children }) {
  const { user, logout } = useAuth()
  return <div className="teacher-app">
    <header className="teacher-header"><div className="brand">Evaluación Digital <span>Profesor</span></div><div className="account">Legajo <strong>{user.legajo}</strong> · [{user.nombre} {user.apellido}] <button onClick={logout}>Cerrar sesión</button></div></header>
    <aside className="teacher-sidebar"><NavLink to="/profesor/misExamenes">Mis exámenes</NavLink><NavLink to="/profesor/correcciones">Corrección</NavLink><NavLink to="/profesor/examenesArchivados">Exámenes archivados</NavLink><NavLink to="/profesor/misCursos">Mis cursos</NavLink></aside>
    <main className="teacher-content">{children}</main>
  </div>
}
