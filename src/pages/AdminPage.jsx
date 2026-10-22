import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import { selectAdminCoursesReady, selectAdminLoadError, selectAdminRows, selectAdminUsersReady, selectFilteredAdminRows, setAdminUserActive, subscribeAdminData } from '../features/admin/adminSlice'
import { eliminarCursoAdmin, importarRegistrosAdmin } from '../services/adminService'
import { parseCsv } from '../utils/parseCsv'

const settings = {
  alumnos: { title: 'Alumnos', create: 'Alta de alumno', path: '/admin/nuevoAlumno', fields: [['all', 'Todos los campos'], ['legajo', 'Legajo'], ['nombre', 'Nombre'], ['curso', 'Curso'], ['estado', 'Estado']] },
  profesores: { title: 'Profesores', create: 'Alta de profesor', path: '/admin/nuevoProfesor', fields: [['all', 'Todos los campos'], ['legajo', 'Legajo'], ['nombre', 'Nombre'], ['curso', 'Curso'], ['estado', 'Estado']] },
  cursos: { title: 'Cursos', create: 'Alta materia', path: '/admin/nuevaMateria', fields: [['all', 'Todos los campos'], ['codigo', 'Código'], ['nombre', 'Nombre'], ['profesor', 'Profesor'], ['comisiones', 'Comisiones']] },
}

export default function AdminPage() {
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const section = settings[searchParams.get('seccion')] ? searchParams.get('seccion') : 'alumnos'
  const config = settings[section]
  const fileInput = useRef(null)
  const [search, setSearch] = useState('')
  const [field, setField] = useState('all')
  const usersReady = useSelector(selectAdminUsersReady)
  const coursesReady = useSelector(selectAdminCoursesReady)
  const loadError = useSelector(selectAdminLoadError)
  const rows = useSelector((state) => selectAdminRows(state, section))
  const filteredRows = useSelector((state) => selectFilteredAdminRows(state, section, search, field, config.fields))
  const [pendingCsv, setPendingCsv] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [courseToDelete, setCourseToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [userToToggle, setUserToToggle] = useState(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => subscribeAdminData(dispatch), [dispatch])

  useEffect(() => { setSearch(''); setField('all'); setActionMessage(''); setPendingCsv(null) }, [section])

  async function chooseCsv(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setActionMessage('')
    try {
      const parsed = parseCsv(await file.text())
      const required = section === 'cursos' ? ['idCurso', 'materia', 'legajoProfe', 'comisiones'] : ['legajo', 'nombre', 'apellido']
      const missing = required.filter((header) => !parsed.headers.includes(header))
      if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}.`)
      setPendingCsv({ fileName: file.name, section, records: parsed.records })
    } catch (error) { setActionMessage(error.message || 'No se pudo leer el CSV.') }
  }

  async function confirmImport() {
    if (!pendingCsv) return
    setImporting(true)
    setProgress('Iniciando importación…')
    try {
      const result = await importarRegistrosAdmin(pendingCsv.section, pendingCsv.records,
        (done, total) => setProgress(`Procesando ${done} de ${total}…`))
      setActionMessage(`${result.created} registro(s) creado(s).${result.failures.length ? ` ${result.failures.length} fila(s) con error: ${result.failures.slice(0, 5).join(' · ')}` : ''}`)
      setPendingCsv(null)
    } catch (error) { setActionMessage(error.message || 'No se pudo importar el archivo.') }
    finally { setImporting(false); setProgress('') }
  }

  async function confirmDelete() {
    if (!courseToDelete) return
    setDeleting(true)
    setActionMessage('')
    try {
      await eliminarCursoAdmin(courseToDelete.idCurso ?? courseToDelete.id)
      setCourseToDelete(null)
      setActionMessage('Materia eliminada correctamente.')
    } catch (error) { setCourseToDelete(null); setActionMessage(error.message || 'No se pudo eliminar la materia.') }
    finally { setDeleting(false) }
  }

  async function confirmToggle() {
    if (!userToToggle) return
    setToggling(true)
    setActionMessage('')
    try {
      const activo = userToToggle.activo === false
      await dispatch(setAdminUserActive({ legajo: userToToggle.legajo, activo })).unwrap()
      setActionMessage(activo ? 'Usuario dado de alta correctamente.' : 'Usuario dado de baja correctamente.')
      setUserToToggle(null)
    } catch (caught) { setActionMessage(caught.message || 'No se pudo cambiar el estado del usuario.'); setUserToToggle(null) }
    finally { setToggling(false) }
  }

  return <AdminShell activeSection={section}>
    <section className="admin-heading"><div><h1>{config.title}</h1><p>Gestioná los registros académicos desde un solo lugar.</p></div><div className="admin-heading-actions"><Link className="primary-action" to={config.path}>+ {config.create}</Link><button type="button" className="secondary-action" onClick={() => fileInput.current?.click()}>Carga masiva CSV</button><input ref={fileInput} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={chooseCsv} aria-label={`Seleccionar CSV de ${section}`} /></div></section>
    <section className="admin-filter-bar"><label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar en ${config.title.toLowerCase()}…`} /></label><label>Filtrar por<select value={field} onChange={(event) => setField(event.target.value)}>{config.fields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><span>{filteredRows.length} de {rows.length} registros</span></section>
    {loadError && <p className="error" role="alert">{loadError}</p>}
    {actionMessage && <p className="admin-action-message" role="status">{actionMessage}</p>}
    <section className="admin-table-card"><div className="admin-table-scroll"><table>
      <thead>{section === 'cursos' ? <tr><th>Código</th><th>Nombre</th><th>Profesor</th><th>Comisiones</th><th>Acciones</th></tr> : <tr><th>Legajo</th><th>Nombre</th><th>Curso</th><th>Estado</th><th>Acciones</th></tr>}</thead>
      <tbody>{filteredRows.map((row) => section === 'cursos' ? <tr key={row.codigo}><td><strong>{row.codigo}</strong></td><td>{row.nombre}</td><td>{row.profesor || 'Sin asignar'}</td><td>{row.comisiones || '—'}</td><td><div className="admin-row-actions"><Link className="admin-edit-action" to={`/admin/panel/editarMateria?id=${encodeURIComponent(row.codigo)}`}>Editar</Link><button type="button" className="admin-delete-action" onClick={() => setCourseToDelete(row.raw)}>Eliminar</button></div></td></tr> : <tr key={row.legajo}><td><strong>{row.legajo}</strong></td><td>{row.nombre}</td><td>{row.curso || 'Sin asignar'}</td><td><span className={`admin-user-status ${row.estado === 'Activo' ? 'active' : row.estado === 'Inactivo' ? 'inactive' : 'pending'}`}>{row.estado}</span></td><td><div className="admin-row-actions"><Link className="admin-edit-action" to={`/admin/panel/${section === 'alumnos' ? 'editarAlumno' : 'editarProfesor'}?id=${encodeURIComponent(row.legajo)}`}>Editar</Link><button type="button" className={row.raw.activo === false ? 'admin-activate-action' : 'admin-delete-action'} onClick={() => setUserToToggle(row.raw)}>{row.raw.activo === false ? 'Dar de alta' : 'Baja'}</button></div></td></tr>)}</tbody>
    </table></div>{!(usersReady && coursesReady) && <p className="table-message">Cargando registros…</p>}{usersReady && coursesReady && filteredRows.length === 0 && <p className="table-message">No hay registros que coincidan con la búsqueda.</p>}</section>
    <p className="admin-csv-hint">CSV de {section}: {section === 'cursos' ? 'idCurso,materia,legajoProfe,comisiones' : section === 'alumnos' ? 'legajo,nombre,apellido,cursosActivos' : 'legajo,nombre,apellido'}. Separá varios valores de una celda con <code>|</code>. Los legajos existentes nunca se sobrescriben.</p>
    {pendingCsv && <ConfirmDialog titleId="csv-title" title="Confirmar carga CSV" actions={<><button type="button" className="secondary-action" disabled={importing} onClick={() => setPendingCsv(null)}>Cancelar</button><button type="button" className="primary-action button-action" disabled={importing} onClick={confirmImport}>{importing ? 'Importando…' : 'Importar'}</button></>}><p>Se intentarán crear {pendingCsv.records.length} registros de {pendingCsv.section} desde «{pendingCsv.fileName}». Los registros existentes no se modificarán.</p>{progress && <p role="status">{progress}</p>}</ConfirmDialog>}
    {courseToDelete && <ConfirmDialog titleId="course-delete-title" title={`¿Eliminar ${courseToDelete.idCurso ?? courseToDelete.id}?`} actions={<><button type="button" className="secondary-action" disabled={deleting} onClick={() => setCourseToDelete(null)}>Cancelar</button><button type="button" className="danger-action" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Eliminando…' : 'Eliminar'}</button></>}><p>La materia se eliminará de Firestore. La operación se bloqueará si hay alumnos inscriptos o exámenes asociados.</p></ConfirmDialog>}
    {userToToggle && <ConfirmDialog titleId="user-status-title" title={userToToggle.activo === false ? `¿Dar de alta a ${userToToggle.nombre} ${userToToggle.apellido}?` : `¿Dar de baja a ${userToToggle.nombre} ${userToToggle.apellido}?`} actions={<><button type="button" className="secondary-action" onClick={() => setUserToToggle(null)} disabled={toggling}>Cancelar</button><button type="button" className={userToToggle.activo === false ? 'admin-activate-action' : 'danger-action'} onClick={confirmToggle} disabled={toggling}>{toggling ? 'Guardando…' : userToToggle.activo === false ? 'Dar de alta' : 'Dar de baja'}</button></>}><p>{userToToggle.activo === false ? 'Volverá a poder ingresar al sistema.' : 'No podrá ingresar ni ser asignado a nuevos cursos o exámenes.'}</p></ConfirmDialog>}
  </AdminShell>
}
