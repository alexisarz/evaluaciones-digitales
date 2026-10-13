import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const dashboardForRole = {
  alumno: '/alumno/misExamenes',
  profesor: '/profesor/misExamenes',
  admin: '/admin/panel',
}

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth()

  if (loading) return <p className="status">Cargando sesión…</p>
  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.rol)) {
    return <Navigate to={dashboardForRole[user.rol] ?? '/login'} replace />
  }

  return <Outlet />
}
