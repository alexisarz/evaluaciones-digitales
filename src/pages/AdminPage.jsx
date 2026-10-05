import { useAuth } from '../context/AuthContext'

export default function AdminPage() {
  const { user, logout } = useAuth()
  return <main className="panel"><h1>Administración</h1><p>Bienvenido/a, {user.nombre} {user.apellido}. El panel de administración se incorporará en una próxima fase.</p><button onClick={logout}>Cerrar sesión</button></main>
}
