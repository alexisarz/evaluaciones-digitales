import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { logout, sessionCleared } from '../auth/authSlice'
import { actualizarCursoAdmin, actualizarUsuarioAdmin, cambiarEstadoUsuarioAdmin, obtenerCursoAdmin, obtenerUsuarioAdmin, restablecerContrasenaAdmin } from '../../services/adminService'

export const loadAdminUser = createAsyncThunk('admin/loadUser', async (legajo) => serializeFirestore(await obtenerUsuarioAdmin(legajo)))
export const loadAdminCourse = createAsyncThunk('admin/loadCourse', async (code) => serializeFirestore(await obtenerCursoAdmin(code)))
export const saveAdminUser = createAsyncThunk('admin/saveUser', (values) => actualizarUsuarioAdmin(values))
export const saveAdminCourse = createAsyncThunk('admin/saveCourse', (values) => actualizarCursoAdmin(values))
export const setAdminUserActive = createAsyncThunk('admin/setUserActive', ({ legajo, activo }) => cambiarEstadoUsuarioAdmin(legajo, activo))
export const resetAdminPassword = createAsyncThunk('admin/resetPassword', (legajo) => restablecerContrasenaAdmin(legajo))

const adminSlice = createSlice({
  name: 'admin',
  initialState: { users: [], courses: [], usersReady: false, coursesReady: false, loadError: '' },
  reducers: {
    usersReceived: (state, action) => { state.users = action.payload; state.usersReady = true },
    coursesReceived: (state, action) => { state.courses = action.payload; state.coursesReady = true },
    usersFailed: (state) => { state.usersReady = true; state.loadError = 'No se pudo cargar la colección users. Revisá los permisos de Firestore.' },
    coursesFailed: (state) => { state.coursesReady = true; state.loadError = 'No se pudo cargar la colección cursos. Revisá los permisos de Firestore.' },
    adminLoadStarted: (state) => { state.usersReady = false; state.coursesReady = false; state.loadError = '' },
  },
  extraReducers: (builder) => {
    const reset = (state) => { state.users = []; state.courses = []; state.usersReady = false; state.coursesReady = false; state.loadError = '' }
    builder.addCase(sessionCleared, reset).addCase(logout.fulfilled, reset)
  },
})

export const { usersReceived, coursesReceived, usersFailed, coursesFailed, adminLoadStarted } = adminSlice.actions
export const selectAdminUsersReady = (state) => state.admin.usersReady
export const selectAdminCoursesReady = (state) => state.admin.coursesReady
export const selectAdminLoadError = (state) => state.admin.loadError
export const selectAdminUsers = (state) => state.admin.users
export const selectAdminCourses = (state) => state.admin.courses

export function subscribeAdminData(dispatch) {
  let active = true
  dispatch(adminLoadStarted())
  const unsubscribeUsers = onSnapshot(collection(db, 'users'),
    (snapshot) => { if (active) dispatch(usersReceived(serializeFirestore(snapshot.docs.map((item) => {
      const { passwordHash, passwordSalt, ...profile } = item.data()
      return { ...profile, id: item.id, claveFirestoreConfigurada: Boolean(passwordHash && passwordSalt) }
    })))) },
    () => { if (active) dispatch(usersFailed()) })
  const unsubscribeCourses = onSnapshot(collection(db, 'cursos'),
    (snapshot) => { if (active) dispatch(coursesReceived(serializeFirestore(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))))) },
    () => { if (active) dispatch(coursesFailed()) })
  return () => { active = false; unsubscribeUsers(); unsubscribeCourses() }
}

const statusOf = (profile) => profile.activo === false ? 'Inactivo' : profile.contrasenaActiva !== true || profile.claveFirestoreConfigurada !== true ? 'Pendiente de activación' : 'Activo'
const normalize = (value) => String(value ?? '').toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const selectAdminRows = createSelector(
  [selectAdminUsers, selectAdminCourses, (_state, section) => section],
  (users, courses, section) => {
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
  },
)

export const selectFilteredAdminRows = createSelector(
  [selectAdminRows, (_state, _section, search) => search, (_state, _section, _search, field) => field, (_state, _section, _search, _field, fields) => fields],
  (rows, search, field, fields) => {
    const needle = normalize(search.trim())
    if (!needle) return rows
    const keys = field === 'all' ? fields.slice(1).map(([key]) => key) : [field]
    return rows.filter((row) => keys.some((key) => normalize(row[key]).includes(needle)))
  },
)

export default adminSlice.reducer
