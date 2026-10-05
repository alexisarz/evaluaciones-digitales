import { useAuth } from '../context/AuthContext'

export default function StudentExamsPage() {
  const { user, logout } = useAuth()
  return <main className="panel"><h1>Mis exámenes</h1><p>Bienvenido/a, {user.nombre} {user.apellido}.</p><button onClick={logout}>Cerrar sesión</button></main>
}
