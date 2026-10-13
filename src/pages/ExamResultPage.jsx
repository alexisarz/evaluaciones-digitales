import { Link } from 'react-router-dom'

export default function ExamResultPage({ failed = false }) {
  return <main className="student-page result-page"><section className={`result-card ${failed ? 'failed' : 'success'}`}>
    <div className="result-icon" aria-hidden="true">{failed ? '!' : '✓'}</div>
    <h1>{failed ? 'Hubo un problema en la entrega del examen' : 'Finalizaste tu examen exitosamente!'}</h1>
    <p>{failed
      ? 'Guardamos tus respuestas en este dispositivo. Volvé a Mis exámenes y usá “REINTENTAR ENTREGA” cuando tengas conexión.'
      : 'Tu entrega quedó registrada. El estado de corrección aparecerá en Mis exámenes.'}</p>
    <Link className="primary-action" to="/alumno/misExamenes">Ir a Mis exámenes</Link>
  </section></main>
}
