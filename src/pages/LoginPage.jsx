import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const routeForRole = {
  alumno: '/alumno/misExamenes',
  profesor: '/profesor/misExamenes',
  admin: '/admin',
}

export default function LoginPage() {
  const { user, login, registerFirstAccess } = useAuth()
  const navigate = useNavigate()
  const [legajo, setLegajo] = useState('')
  const [password, setPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={routeForRole[user.rol] ?? '/login'} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const profile = firstAccess
        ? await registerFirstAccess(legajo, password)
        : await login(legajo, password)
      navigate(routeForRole[profile.rol] ?? '/login', { replace: true })
    } catch (submitError) {
      setError(submitError.message || 'No se pudo completar la operación.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Evaluación Digital</h1>
        <p>{firstAccess ? 'Definí tu contraseña para activar la cuenta.' : 'Ingresá con tu legajo y contraseña.'}</p>
        <label>
          Legajo
          <input value={legajo} onChange={(e) => setLegajo(e.target.value)} inputMode="numeric" required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength="6" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={submitting}>{submitting ? 'Procesando…' : firstAccess ? 'Activar cuenta' : 'Ingresar'}</button>
        <button type="button" className="link-button" onClick={() => setFirstAccess(!firstAccess)}>
          {firstAccess ? 'Ya tengo contraseña' : 'Es mi primer ingreso'}
        </button>
      </form>
    </main>
  )
}
