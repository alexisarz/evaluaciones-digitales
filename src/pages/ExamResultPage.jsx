import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export default function ExamResultPage({ failed = false }) {
  const { state } = useLocation()
  const { logout } = useAuth()
  const forced = !failed && state?.forced === true
  const localUnsynced = !failed && state?.localUnsynced === true
  return <main className="student-page result-page"><section className={`result-card ${failed ? 'failed' : 'success'}`}>
    <div className="result-icon" aria-hidden="true">{failed ? '!' : '✓'}</div>
    <h1>{failed ? 'Hubo un problema en la entrega del examen' : forced ? 'El profesor finalizó el examen' : 'Finalizaste tu examen exitosamente!'}</h1>
    <p>{failed
      ? 'Guardamos tus respuestas en este dispositivo. Volvé a Mis exámenes y usá “REINTENTAR ENTREGA” cuando tengas conexión.'
      : forced ? 'Se entregaron automáticamente las respuestas que estaban guardadas. El estado de corrección aparecerá en Mis exámenes.'
        : 'Tu entrega quedó registrada. El estado de corrección aparecerá en Mis exámenes.'}</p>
    {localUnsynced && <p className="result-unsynced" role="alert">Hay respuestas guardadas solo en este dispositivo que no llegaron a la entrega. {state.backupSaved ? 'Conservamos un respaldo local; contactá al profesor.' : 'No se pudo confirmar el respaldo local; contactá al profesor.'}</p>}
    {failed
      ? <Link className="primary-action" to="/alumno/misExamenes">Ir a Mis exámenes</Link>
      : <button type="button" className="primary-action" onClick={logout}>Cerrar sesión</button>}
  </section></main>
}
