import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import DigitsOnlyInput from '../shared/components/DigitsOnlyInput'
import PasswordInput from '../shared/components/PasswordInput'

const routeForRole = {
  alumno: '/alumno/misExamenes',
  profesor: '/profesor/misExamenes',
  admin: '/admin/panel',
}

export default function LoginPage() {
  const { user, login, registerFirstAccess } = useAuth()
  const navigate = useNavigate()
  const [legajo, setLegajo] = useState('')
  const [password, setPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)

  if (user) return <Navigate to={routeForRole[user.rol] ?? '/login'} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setErrorCode('')
    setSubmitting(true)
    try {
      const profile = firstAccess
        ? await registerFirstAccess(legajo, password)
        : await login(legajo, password)
      navigate(routeForRole[profile.rol] ?? '/login', { replace: true })
    } catch (submitError) {
      setErrorCode(submitError.code ?? '')
      setError(firstAccess
        ? (submitError.message || 'No se pudo activar la cuenta.')
        : ['account/inactive', 'account/reset-required'].includes(submitError.code)
          ? submitError.message : 'No se pudo iniciar sesión con esas credenciales.')
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
          <DigitsOnlyInput value={legajo} onChange={setLegajo} autoComplete="username" required />
        </label>
        <div className="login-field"><label htmlFor="login-password">Contraseña</label><PasswordInput id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={firstAccess ? 'new-password' : 'current-password'} minLength="6" required /></div>
        {error && <p className="error" role="alert">{errorCode === 'account/inactive' ? <>Tu usuario se encuentra dado de baja, contactá con el administrador a <a href="mailto:admin_evaluaciondigital@uade.com.ar">admin_evaluaciondigital@uade.com.ar</a></> : error}</p>}
        <button disabled={submitting}>{submitting ? 'Procesando…' : firstAccess ? 'Activar cuenta' : 'Ingresar'}</button>
        <button type="button" className="link-button" onClick={() => setFirstAccess(!firstAccess)}>
          {firstAccess ? 'Ya tengo contraseña' : 'Es mi primer ingreso'}
        </button>
        <button type="button" className="recovery-link" onClick={() => setShowRecovery(true)}>
          Olvidé mi contraseña
        </button>
      </form>
      {showRecovery && (
        <div className="modal-backdrop" role="presentation">
          <section className="recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
            <h2 id="recovery-title">Recupero de contraseña</h2>
            <p>Para blanquear tu clave, enviá un mail a <a href="mailto:blanqueos_de_claves@evaluacionesuade.com.ar">blanqueos_de_claves@evaluacionesuade.com.ar</a> indicando tu legajo y tu nombre completo. El administrador verificará tu identidad y, una vez blanqueada, vas a definir una nueva contraseña al ingresar.</p>
            <button type="button" onClick={() => setShowRecovery(false)}>Aceptar</button>
          </section>
        </div>
      )}
    </main>
  )
}
