import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import ConfirmDialog from '../shared/components/ConfirmDialog'
import { loadAdminCourse, loadAdminUser, resetAdminPassword, saveAdminCourse, saveAdminUser, selectAdminCourses, selectAdminUsers, subscribeAdminData } from '../features/admin/adminSlice'

const details = {
  alumno: { title: 'Editar alumno', section: 'alumnos' },
  profesor: { title: 'Editar profesor', section: 'profesores' },
  curso: { title: 'Editar materia', section: 'cursos' },
}

export default function AdminEditPage({ type }) {
  const { title, section } = details[type]
  const [params] = useSearchParams()
  const id = params.get('id')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const courses = useSelector(selectAdminCourses)
  const users = useSelector(selectAdminUsers)
  const [form, setForm] = useState(null)
  const [initial, setInitial] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dialog, setDialog] = useState(null)
  const backPath = `/admin/panel?seccion=${section}`
  const dirty = form && initial && JSON.stringify(form) !== JSON.stringify(initial)

  useEffect(() => subscribeAdminData(dispatch), [dispatch])
  useEffect(() => {
    setForm(null); setInitial(null); setError(''); setMessage('')
    if (!id) { setError('Falta el ID del registro.'); setLoading(false); return undefined }
    let active = true
    setLoading(true)
    const request = dispatch(type === 'curso' ? loadAdminCourse(id) : loadAdminUser(id))
    void request.unwrap().then((record) => {
      if (!active) return
      if (type !== 'curso' && record.rol !== type) throw new Error('El usuario no corresponde a esta sección.')
      const values = type === 'curso'
        ? { idCurso: record.idCurso ?? record.id, materia: record.materia ?? '', legajoProfe: String(record.legajoProfe ?? ''), comisiones: (record.comisiones ?? []).join(', ') }
        : { legajo: String(record.legajo ?? record.id), nombre: record.nombre ?? '', apellido: record.apellido ?? '', activo: record.activo === true, contrasenaActiva: record.contrasenaActiva === true && record.claveFirestoreConfigurada === true, cursosActivos: record.cursosActivos ?? [] }
      setForm(values); setInitial(values); setError('')
    }).catch((caught) => { if (active) setError(caught.message || 'No se pudo cargar el registro.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; request.abort() }
  }, [dispatch, id, type])

  const cancel = () => dirty ? setDialog('cancel') : navigate(backPath)

  async function save(event) {
    event.preventDefault()
    setSaving(true); setError(''); setMessage('')
    try {
      if (type === 'curso') {
        await dispatch(saveAdminCourse({ ...form, comisiones: form.comisiones.split(/[,;|\n]/) })).unwrap()
      } else {
        await dispatch(saveAdminUser({ ...form, rol: type })).unwrap()
      }
      navigate(backPath, { replace: true })
    } catch (caught) { setError(caught.message || 'No se pudieron guardar los cambios.') }
    finally { setSaving(false) }
  }

  async function resetPassword() {
    setResetting(true); setError(''); setMessage('')
    try {
      await dispatch(resetAdminPassword(form.legajo)).unwrap()
      setForm((current) => ({ ...current, contrasenaActiva: false }))
      setInitial((current) => ({ ...current, contrasenaActiva: false }))
      setMessage('Contraseña restablecida. El usuario deberá definir una nueva clave en «Es mi primer ingreso».')
      setDialog(null)
    } catch (caught) { setError(caught.message || 'No se pudo restablecer la contraseña.'); setDialog(null) }
    finally { setResetting(false) }
  }

  const toggleCourse = (code) => setForm((current) => ({ ...current, cursosActivos: current.cursosActivos.includes(code)
    ? current.cursosActivos.filter((item) => item !== code) : [...current.cursosActivos, code] }))

  return <AdminShell activeSection={section}>
    <div className="admin-create-heading"><button type="button" className="admin-back-link" onClick={cancel}>← Volver a {section}</button><h1>{title}</h1><p>Los identificadores no se modifican para conservar las relaciones existentes.</p></div>
    {loading && <p className="table-message">Cargando registro…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="admin-action-message" role="status">{message}</p>}
    {!loading && form && <form className="admin-create-form" onSubmit={save}>
      {type === 'curso' ? <section className="admin-form-card"><h2>Datos de la materia</h2><div className="admin-form-grid">
        <label>Código del curso<input value={form.idCurso} disabled /></label>
        <label>Nombre de la materia<input value={form.materia} onChange={(event) => setForm((current) => ({ ...current, materia: event.target.value }))} required /></label>
        <label>Profesor responsable<select value={form.legajoProfe} onChange={(event) => setForm((current) => ({ ...current, legajoProfe: event.target.value }))} required><option value="">Seleccionar profesor</option>{users.filter((item) => item.rol === 'profesor' && (item.activo === true || String(item.legajo) === form.legajoProfe)).map((item) => <option key={item.id} value={item.legajo}>{item.legajo} · {item.nombre} {item.apellido}{item.activo === false ? ' (inactivo)' : ''}</option>)}</select></label>
        <label>Comisiones<input value={form.comisiones} onChange={(event) => setForm((current) => ({ ...current, comisiones: event.target.value }))} required /><small>Separá las comisiones con coma, punto y coma o |.</small></label>
      </div><p className="admin-form-note">Si ya hay exámenes, no se puede cambiar el profesor ni quitar una comisión utilizada.</p></section> : <>
        <section className="admin-form-card"><h2>Datos personales</h2><div className="admin-form-grid">
          <label>Legajo<input value={form.legajo} disabled /></label>
          <label>Nombre<input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} required /></label>
          <label>Apellido<input value={form.apellido} onChange={(event) => setForm((current) => ({ ...current, apellido: event.target.value }))} required /></label>
          <label>Estado<input value={form.activo ? 'Activo' : 'Inactivo'} disabled /></label>
        </div></section>
        {type === 'alumno' && <section className="admin-form-card"><h2>Cursos activos</h2><div className="admin-course-options">{courses.map((course) => { const code = course.idCurso ?? course.id; return <label key={code}><input type="checkbox" checked={form.cursosActivos.includes(code)} onChange={() => toggleCourse(code)} disabled={!form.activo && !form.cursosActivos.includes(code)} /><span><strong>{code}</strong> · {course.materia}</span></label> })}</div></section>}
        {type === 'profesor' && <section className="admin-form-card"><h2>Cursos a cargo</h2><p>{courses.filter((course) => Number(course.legajoProfe) === Number(form.legajo)).map((course) => course.idCurso ?? course.id).join(', ') || 'Sin cursos asignados.'}</p><p className="admin-form-note">Para cambiar un profesor responsable, editá la materia correspondiente.</p></section>}
        <section className="admin-form-card"><h2>Contraseña</h2><p>{form.contrasenaActiva ? 'La contraseña está activa.' : 'Pendiente de definir una contraseña.'}</p><button type="button" className="admin-reset-password" onClick={() => setDialog('reset')} disabled={resetting}>Restablecer contraseña</button></section>
      </>}
      <div className="admin-form-actions"><button type="button" className="secondary-action" onClick={cancel} disabled={saving}>Cancelar</button><button type="submit" className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </form>}
    {dialog === 'cancel' && <ConfirmDialog titleId="admin-cancel-title" title="¿Salir sin guardar?" actions={<><button type="button" className="secondary-action" onClick={() => setDialog(null)}>Seguir editando</button><button type="button" className="danger-action" onClick={() => navigate(backPath)}>Salir</button></>}><p>Si salís, perderás los cambios que no guardaste.</p></ConfirmDialog>}
    {dialog === 'reset' && <ConfirmDialog titleId="admin-reset-title" title="¿Restablecer contraseña?" actions={<><button type="button" className="secondary-action" onClick={() => setDialog(null)} disabled={resetting}>Cancelar</button><button type="button" className="admin-reset-password" onClick={resetPassword} disabled={resetting}>{resetting ? 'Restableciendo…' : 'Restablecer contraseña'}</button></>}><p>Se borrará la clave guardada en Firestore. El usuario tendrá que definir una nueva en «Es mi primer ingreso».</p></ConfirmDialog>}
  </AdminShell>
}
