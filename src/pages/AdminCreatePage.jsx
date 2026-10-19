import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import AdminShell from '../components/AdminShell'
import { db } from '../firebase'
import { crearCursoAdmin, crearUsuarioAdmin } from '../services/adminService'
import DigitsOnlyInput from '../shared/components/DigitsOnlyInput'

const details = {
  alumno: { title: 'Alta de alumno', section: 'alumnos' },
  profesor: { title: 'Alta de profesor', section: 'profesores' },
  curso: { title: 'Alta de materia', section: 'cursos' },
}

export default function AdminCreatePage({ type }) {
  const navigate = useNavigate()
  const { title, section } = details[type]
  const [form, setForm] = useState({ legajo: '', nombre: '', apellido: '', idCurso: '', materia: '', legajoProfe: '', comisiones: '' })
  const [selectedCourses, setSelectedCourses] = useState([])
  const [courses, setCourses] = useState([])
  const [professors, setProfessors] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(type !== 'profesor')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (type === 'profesor') { setLoadingOptions(false); return }
    let mounted = true
    setLoadingOptions(true)
    const source = type === 'alumno' ? 'cursos' : 'users'
    getDocs(collection(db, source)).then((snapshot) => {
      if (!mounted) return
      if (type === 'alumno') setCourses(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).sort((a, b) => (a.idCurso ?? a.id).localeCompare(b.idCurso ?? b.id)))
      else setProfessors(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).filter((user) => user.rol === 'profesor' && user.activo === true))
    }).catch(() => { if (mounted) setError(`No se pudo cargar la colección ${source}. Revisá los permisos de Firestore.`) })
      .finally(() => { if (mounted) setLoadingOptions(false) })
    return () => { mounted = false }
  }, [type])

  function change(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function toggleCourse(code) {
    setSelectedCourses((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code])
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (type === 'curso') {
        await crearCursoAdmin({
          idCurso: form.idCurso,
          materia: form.materia,
          legajoProfe: form.legajoProfe,
          comisiones: form.comisiones.split(/[,;|\n]/),
        })
      } else {
        await crearUsuarioAdmin({
          legajo: form.legajo,
          nombre: form.nombre,
          apellido: form.apellido,
          rol: type,
          cursosActivos: type === 'alumno' ? selectedCourses : [],
        })
      }
      navigate(`/admin/panel?seccion=${section}`, { replace: true })
    } catch (caught) {
      setError(caught.message || 'No se pudo guardar el registro.')
      setSaving(false)
    }
  }

  return <AdminShell activeSection={section}>
    <div className="admin-create-heading"><Link to={`/admin/panel?seccion=${section}`}>← Volver a {section}</Link><h1>{title}</h1><p>{type === 'curso' ? 'Creá un curso y asignale su profesor responsable.' : 'El usuario definirá su contraseña en el primer ingreso.'}</p></div>
    <form className="admin-create-form" onSubmit={submit}>
      {type === 'curso' ? <>
        <section className="admin-form-card"><h2>Datos de la materia</h2><div className="admin-form-grid">
          <label>Código del curso<input name="idCurso" value={form.idCurso} onChange={change} required placeholder="2A-TEST" /></label>
          <label>Nombre de la materia<input name="materia" value={form.materia} onChange={change} required placeholder="Testing de aplicaciones" /></label>
          <label>Profesor responsable<select name="legajoProfe" value={form.legajoProfe} onChange={change} required disabled={loadingOptions}><option value="">Seleccionar profesor</option>{professors.map((professor) => <option key={professor.id} value={professor.legajo ?? professor.id}>{professor.legajo ?? professor.id} · {professor.nombre} {professor.apellido}</option>)}</select></label>
          <label>Comisiones<input name="comisiones" value={form.comisiones} onChange={change} required placeholder="Comisión A, Comisión B" /><small>Separá las comisiones con coma, punto y coma o |.</small></label>
        </div>{!loadingOptions && !professors.length && <p className="admin-form-note">Primero necesitás dar de alta un profesor activo.</p>}</section>
      </> : <>
        <section className="admin-form-card"><h2>Datos personales</h2><div className="admin-form-grid">
          <label>Legajo<DigitsOnlyInput name="legajo" value={form.legajo} onChange={(legajo) => setForm((current) => ({ ...current, legajo }))} required placeholder="1098765" /></label>
          <label>Nombre<input name="nombre" value={form.nombre} onChange={change} required /></label>
          <label>Apellido<input name="apellido" value={form.apellido} onChange={change} required /></label>
        </div><p className="admin-form-note">Se guardará como activo, pendiente de activación y sin contraseña. No se crea aún una cuenta en Firebase Auth.</p></section>
        {type === 'alumno' && <section className="admin-form-card"><h2>Cursos activos</h2><p>Elegí los cursos en los que está inscripto el alumno. Podés dejar este campo vacío.</p><div className="admin-course-options">{courses.map((course) => {
          const code = course.idCurso ?? course.id
          return <label key={code}><input type="checkbox" checked={selectedCourses.includes(code)} onChange={() => toggleCourse(code)} /><span><strong>{code}</strong> · {course.materia}</span></label>
        })}{!loadingOptions && courses.length === 0 && <p>No hay cursos disponibles todavía.</p>}</div></section>}
        {type === 'profesor' && <p className="admin-form-note">Los cursos a cargo se asignan al crear una materia. El listado de profesores los mostrará automáticamente.</p>}
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="admin-form-actions"><Link className="secondary-action" to={`/admin/panel?seccion=${section}`}>Cancelar</Link><button className="primary-action" type="submit" disabled={saving || loadingOptions}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </AdminShell>
}
