import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import AdminShell from '../components/AdminShell'
import { db } from '../firebase'
import { eliminarCursoAdmin, importarRegistrosAdmin } from '../services/adminService'
import { parseCsv } from '../utils/parseCsv'

const settings = {
  alumnos: { title: 'Alumnos', create: 'Alta de alumno', path: '/admin/nuevoAlumno', fields: [['all', 'Todos los campos'], ['legajo', 'Legajo'], ['nombre', 'Nombre'], ['curso', 'Curso'], ['estado', 'Estado']] },
  profesores: { title: 'Profesores', create: 'Alta de profesor', path: '/admin/nuevoProfesor', fields: [['all', 'Todos los campos'], ['legajo', 'Legajo'], ['nombre', 'Nombre'], ['curso', 'Curso'], ['estado', 'Estado']] },
  cursos: { title: 'Cursos', create: 'Alta materia', path: '/admin/nuevaMateria', fields: [['all', 'Todos los campos'], ['codigo', 'Código'], ['nombre', 'Nombre'], ['profesor', 'Profesor'], ['comisiones', 'Comisiones']] },
}

function statusOf(profile) {
  if (profile.activo === false) return 'Inactivo'
  if (profile.contrasenaActiva !== true) return 'Pendiente de activación'
  return 'Activo'
}

function matchText(value, needle) {
  return String(value ?? '').toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(needle)
}

export default function AdminPage() {
  const [searchParams] = useSearchParams()
  const section = settings[searchParams.get('seccion')] ? searchParams.get('seccion') : 'alumnos'
  const config = settings[section]
  const fileInput = useRef(null)
  const [users, setUsers] = useState([])
  const [courses, setCourses] = useState([])
  const [usersReady, setUsersReady] = useState(false)
  const [coursesReady, setCoursesReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [field, setField] = useState('all')
  const [pendingCsv, setPendingCsv] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [courseToDelete, setCourseToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'),
      (snapshot) => { setUsers(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))); setUsersReady(true) },
      () => { setLoadError('No se pudo cargar la colección users. Revisá los permisos de Firestore.'); setUsersReady(true) })
    const unsubscribeCourses = onSnapshot(collection(db, 'cursos'),
      (snapshot) => { setCourses(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))); setCoursesReady(true) },
      () => { setLoadError('No se pudo cargar la colección cursos. Revisá los permisos de Firestore.'); setCoursesReady(true) })
    return () => { unsubscribeUsers(); unsubscribeCourses() }
  }, [])

  useEffect(() => { setSearch(''); setField('all'); setActionMessage(''); setPendingCsv(null) }, [section])

  const rows = useMemo(() => {
    if (section === 'cursos') return courses.map((course) => ({
      raw: course,
      codigo: course.idCurso ?? course.id,
      nombre: course.materia ?? '',
      profesor: String(course.legajoProfe ?? ''),
      comisiones: (course.comisiones ?? []).join(', '),
    })).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es-AR'))

    const role = section === 'alumnos' ? 'alumno' : 'profesor'
    return users.filter((item) => item.rol === role).map((profile) => ({
      raw: profile,
      legajo: String(profile.legajo ?? profile.id),
      nombre: `${profile.nombre ?? ''} ${profile.apellido ?? ''}`.trim(),
      curso: role === 'profesor'
        ? courses.filter((course) => Number(course.legajoProfe) === Number(profile.legajo)).map((course) => course.idCurso ?? course.id).join(', ')
        : (profile.cursosActivos ?? []).join(', '),
      estado: statusOf(profile),
    })).sort((a, b) => Number(a.legajo) - Number(b.legajo))
  }, [section, users, courses])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (!needle) return rows
    return rows.filter((row) => (field === 'all' ? config.fields.slice(1).map(([key]) => key) : [field])
      .some((key) => matchText(row[key], needle)))
  }, [rows, search, field, config])

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

  return <AdminShell activeSection={section}>
    <section className="admin-heading"><div><h1>{config.title}</h1><p>Gestioná los registros académicos desde un solo lugar.</p></div><div className="admin-heading-actions"><Link className="primary-action" to={config.path}>+ {config.create}</Link><button type="button" className="secondary-action" onClick={() => fileInput.current?.click()}>Carga masiva CSV</button><input ref={fileInput} type="file" accept=".csv,text/csv" className="visually-hidden" onChange={chooseCsv} aria-label={`Seleccionar CSV de ${section}`} /></div></section>
    <section className="admin-filter-bar"><label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar en ${config.title.toLowerCase()}…`} /></label><label>Filtrar por<select value={field} onChange={(event) => setField(event.target.value)}>{config.fields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><span>{filteredRows.length} de {rows.length} registros</span></section>
    {loadError && <p className="error" role="alert">{loadError}</p>}
    {actionMessage && <p className="admin-action-message" role="status">{actionMessage}</p>}
    <section className="admin-table-card"><div className="admin-table-scroll"><table>
      <thead>{section === 'cursos' ? <tr><th>Código</th><th>Nombre</th><th>Profesor</th><th>Comisiones</th><th>Acciones</th></tr> : <tr><th>Legajo</th><th>Nombre</th><th>Curso</th><th>Estado</th><th>Acciones</th></tr>}</thead>
      <tbody>{filteredRows.map((row) => section === 'cursos' ? <tr key={row.codigo}><td><strong>{row.codigo}</strong></td><td>{row.nombre}</td><td>{row.profesor || 'Sin asignar'}</td><td>{row.comisiones || '—'}</td><td><div className="admin-row-actions"><button type="button" className="admin-edit-action" disabled title="Edición disponible próximamente">Editar</button><button type="button" className="admin-delete-action" onClick={() => setCourseToDelete(row.raw)}>Eliminar</button></div></td></tr> : <tr key={row.legajo}><td><strong>{row.legajo}</strong></td><td>{row.nombre}</td><td>{row.curso || 'Sin asignar'}</td><td><span className={`admin-user-status ${row.estado === 'Activo' ? 'active' : row.estado === 'Inactivo' ? 'inactive' : 'pending'}`}>{row.estado}</span></td><td><div className="admin-row-actions"><button type="button" className="admin-edit-action" disabled title="Edición disponible próximamente">Editar</button><button type="button" className="admin-delete-action" disabled title="Baja disponible próximamente">Baja</button></div></td></tr>)}</tbody>
    </table></div>{!(usersReady && coursesReady) && <p className="table-message">Cargando registros…</p>}{usersReady && coursesReady && filteredRows.length === 0 && <p className="table-message">No hay registros que coincidan con la búsqueda.</p>}</section>
    <p className="admin-csv-hint">CSV de {section}: {section === 'cursos' ? 'idCurso,materia,legajoProfe,comisiones' : section === 'alumnos' ? 'legajo,nombre,apellido,cursosActivos' : 'legajo,nombre,apellido'}. Separá varios valores de una celda con <code>|</code>. Los legajos existentes nunca se sobrescriben.</p>
    {pendingCsv && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="csv-title"><h2 id="csv-title">Confirmar carga CSV</h2><p>Se intentarán crear {pendingCsv.records.length} registros de {pendingCsv.section} desde «{pendingCsv.fileName}». Los registros existentes no se modificarán.</p>{progress && <p role="status">{progress}</p>}<div><button type="button" className="secondary-action" disabled={importing} onClick={() => setPendingCsv(null)}>Cancelar</button><button type="button" className="primary-action button-action" disabled={importing} onClick={confirmImport}>{importing ? 'Importando…' : 'Importar'}</button></div></section></div>}
    {courseToDelete && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="course-delete-title"><h2 id="course-delete-title">¿Eliminar {courseToDelete.idCurso ?? courseToDelete.id}?</h2><p>La materia se eliminará de Firestore. La operación se bloqueará si hay alumnos inscriptos o exámenes asociados.</p><div><button type="button" className="secondary-action" disabled={deleting} onClick={() => setCourseToDelete(null)}>Cancelar</button><button type="button" className="danger-action" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Eliminando…' : 'Eliminar'}</button></div></section></div>}
  </AdminShell>
}
