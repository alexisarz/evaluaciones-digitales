import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const sections = [
  { id: 'alumnos', label: 'Alumnos' },
  { id: 'profesores', label: 'Profesores' },
  { id: 'cursos', label: 'Cursos' },
]

export default function AdminShell({ activeSection, children }) {
  const { user, logout } = useAuth()
  return <div className="admin-app">
    <header className="admin-header"><div className="brand">Evaluación Digital <span>Administrador</span></div><div className="account">Legajo <strong>{user.legajo}</strong> · {user.nombre} {user.apellido}<button type="button" onClick={logout}>Cerrar sesión</button></div></header>
    <aside className="admin-sidebar" aria-label="Secciones de administración">{sections.map((section) => <Link key={section.id} className={activeSection === section.id ? 'active' : ''} aria-current={activeSection === section.id ? 'page' : undefined} to={`/admin/panel?seccion=${section.id}`}>{section.label}</Link>)}</aside>
    <main className="admin-content">{children}</main>
  </div>
}
