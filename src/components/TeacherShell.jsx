import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function TeacherShell({ children }) {
  const { user, logout } = useAuth()
  return <div className="teacher-app">
    <header className="teacher-header"><div className="brand">Evaluación Digital <span>Profesor</span></div><div className="account">Legajo <strong>{user.legajo}</strong> · [{user.nombre} {user.apellido}] <button onClick={logout}>Cerrar sesión</button></div></header>
    <aside className="teacher-sidebar"><NavLink to="/profesor/misExamenes">Mis exámenes</NavLink><button className="sidebar-link" disabled>Corrección</button><button className="sidebar-link" disabled>Mis comisiones</button></aside>
    <main className="teacher-content">{children}</main>
  </div>
}
