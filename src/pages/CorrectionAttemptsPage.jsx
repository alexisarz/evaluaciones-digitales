import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import TeacherShell from '../components/TeacherShell'
import { useAuth } from '../features/auth/useAuth'
import { loadCorrectionExam, selectCorrectionExam, selectCorrectionListError, selectCorrectionListLoading, selectFilteredCorrectionDeliveries } from '../features/corrections/correctionsSlice'

export default function CorrectionAttemptsPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [params] = useSearchParams()
  const examId = params.get('id')
  const [search, setSearch] = useState('')
  const [field, setField] = useState('todos')
  const [status, setStatus] = useState('todos')
  const exam = useSelector(selectCorrectionExam)
  const loading = useSelector(selectCorrectionListLoading)
  const error = useSelector(selectCorrectionListError)
  const deliveries = useSelector((state) => selectFilteredCorrectionDeliveries(state, search, field, status))

  useEffect(() => {
    if (!examId) return undefined
    const request = dispatch(loadCorrectionExam({ examId, legajoProfe: user.legajo }))
    return () => request.abort()
  }, [dispatch, examId, user.legajo])

  return <TeacherShell>
    <section className="new-exam-header"><div><Link to="/profesor/correcciones">← Correcciones</Link><h1>{exam?.nombre ?? 'Corregir examen'}</h1><p className="correction-subtitle">{exam?.cursoCodigo} · {exam?.materia}</p></div></section>
    {!examId && <p className="error" role="alert">Falta el ID del examen.</p>}
    {loading && <p className="table-message">Cargando entregas…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!loading && !error && exam?.id === examId && <>
      <div className="correction-filters"><label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, legajo, tema o estado" /></label><label>Buscar por<select value={field} onChange={(event) => setField(event.target.value)}><option value="todos">Todos los campos</option><option value="nombre">Nombre</option><option value="legajo">Legajo</option><option value="tema">Tema</option><option value="estado">Estado</option></select></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos</option><option value="pendiente">Pendiente</option><option value="corregido">Corregido</option></select></label></div>
      <section className="exam-table-card"><div className="table-scroll"><table><thead><tr><th>Alumno</th><th>Legajo</th><th>Tema</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{deliveries.map((delivery) => <tr key={delivery.id}><td><strong>{delivery.nombreAlumno} {delivery.apellidoAlumno}</strong></td><td>{delivery.legajoAlumno}</td><td><span className="correction-topic" style={{ backgroundColor: delivery.tema?.color ?? '#244a87' }}>{delivery.tema?.nombreTema ?? 'Sin tema'}</span></td><td><span className={`status-pill ${delivery.estadoCorreccion === 'corregido' ? 'cerrado' : 'para_corregir'}`}>{delivery.estadoCorreccion === 'corregido' ? 'Corregido' : 'Pendiente'}</span></td><td><Link className="text-action" to={`/profesor/corregirExamen/examenAlumno?id=${encodeURIComponent(delivery.id)}`}>{delivery.estadoCorreccion === 'corregido' ? 'Ver corrección' : delivery.correccionIniciada ? 'Continuar corrección' : 'Corregir'}</Link></td></tr>)}</tbody></table></div>{deliveries.length === 0 && <p className="table-message">No hay entregas que coincidan con los filtros.</p>}</section>
    </>}
  </TeacherShell>
}
