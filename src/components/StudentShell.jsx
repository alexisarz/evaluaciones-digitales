import { useAuth } from '../features/auth/useAuth'

export default function StudentShell({ children }) {
  const { user, logout } = useAuth()

  return <main className="student-page">
    <header className="student-header"><div className="brand">Evaluación Digital <span>Alumno</span></div><span className="student-account">Legajo {user.legajo} · {user.nombre} {user.apellido}</span><button type="button" onClick={logout}>Cerrar sesión</button></header>
    <section className="student-content">{children}</section>
  </main>
}
