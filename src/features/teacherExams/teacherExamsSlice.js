import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { actualizarExamen, archivarExamen, archivarExamenes, borrarExamen, crearExamen, dateAndTimeToTimestamp, moverExamenesAArchivosDefinitivos, obtenerExamenesPorProfesor } from '../../services/examsService'
import { obtenerCursosPorProfesor } from '../../services/coursesService'
import { escucharConteoEntregasPorProfesor, obtenerConteoEntregasPorProfesor } from '../../services/examAttemptService'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { getEffectiveExamStatus } from '../../utils/examWindow'
import { logout, sessionCleared } from '../auth/authSlice'

export const loadTeacherExams = createAsyncThunk('teacherExams/load', async (legajo) => {
  const [exams, courses, deliveryCounts] = await Promise.all([
    obtenerExamenesPorProfesor(legajo),
    obtenerCursosPorProfesor(legajo),
    obtenerConteoEntregasPorProfesor(legajo),
  ])
  return serializeFirestore({ exams, courses, deliveryCounts })
})

export const deleteTeacherExam = createAsyncThunk('teacherExams/delete', async ({ id, legajoProfe }) => {
  await borrarExamen(id, legajoProfe)
  return id
})

export const archiveTeacherExam = createAsyncThunk('teacherExams/archive', async ({ id, legajoProfe }) => {
  await archivarExamen(id, legajoProfe)
  return id
})

export const archiveTeacherExams = createAsyncThunk('teacherExams/archiveMany', async ({ ids, legajoProfe }) =>
  archivarExamenes(ids, legajoProfe))

export const moveTeacherExamsToFinalArchive = createAsyncThunk('teacherExams/finalArchive', async ({ ids, legajoProfe }) =>
  moverExamenesAArchivosDefinitivos(ids, legajoProfe))

export const saveTeacherExam = createAsyncThunk('teacherExams/save', async ({ examId, datosExamen, legajoProfe }) => {
  const { fecha, hora, ...fields } = datosExamen
  const record = { ...fields, fechaInicio: dateAndTimeToTimestamp(fecha, hora) }
  if (examId) {
    await actualizarExamen(examId, record, legajoProfe)
    return examId
  }
  const reference = await crearExamen(record)
  return reference.id
})

const teacherExamsSlice = createSlice({
  name: 'teacherExams',
  initialState: { exams: [], courses: [], deliveryCounts: {}, loading: true, error: '', requestId: null },
  reducers: {
    resetTeacherExams: (state) => { state.exams = []; state.courses = []; state.deliveryCounts = {}; state.error = '' },
    deliveryCountsReceived: (state, action) => { state.deliveryCounts = action.payload },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadTeacherExams.pending, (state, action) => { state.exams = []; state.courses = []; state.deliveryCounts = {}; state.loading = true; state.error = ''; state.requestId = action.meta.requestId })
      .addCase(loadTeacherExams.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.exams = action.payload.exams
        state.courses = action.payload.courses
        state.deliveryCounts = action.payload.deliveryCounts
        state.loading = false
        state.requestId = null
      })
      .addCase(loadTeacherExams.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.requestId = null
        if (action.meta.aborted) return
        state.loading = false; state.error = 'No se pudieron cargar tus exámenes o cursos. Intentá nuevamente.'
      })
      .addCase(deleteTeacherExam.fulfilled, (state, action) => { state.exams = state.exams.filter((exam) => exam.id !== action.payload); delete state.deliveryCounts[action.payload] })
      .addCase(archiveTeacherExam.fulfilled, (state, action) => {
        const exam = state.exams.find((item) => item.id === action.payload)
        if (exam) exam.archivado = true
      })
      .addCase(archiveTeacherExams.fulfilled, (state, action) => {
        const archived = new Set(action.payload)
        state.exams.forEach((exam) => { if (archived.has(exam.id)) exam.archivado = true })
      })
      .addCase(moveTeacherExamsToFinalArchive.fulfilled, (state, action) => {
        const removed = new Set(action.payload)
        state.exams = state.exams.filter((exam) => !removed.has(exam.id))
        for (const id of removed) delete state.deliveryCounts[id]
      })
      .addCase(sessionCleared, (state) => { state.exams = []; state.courses = []; state.deliveryCounts = {}; state.loading = true; state.error = ''; state.requestId = null })
      .addCase(logout.fulfilled, (state) => { state.exams = []; state.courses = []; state.deliveryCounts = {}; state.loading = true; state.error = ''; state.requestId = null })
  },
})

export const { resetTeacherExams, deliveryCountsReceived } = teacherExamsSlice.actions
export const subscribeTeacherDeliveryCounts = (dispatch, legajoProfe) =>
  escucharConteoEntregasPorProfesor(legajoProfe, (counts) => dispatch(deliveryCountsReceived(counts)), () => {})
export const selectTeacherExams = (state) => state.teacherExams.exams
export const selectTeacherCourses = (state) => state.teacherExams.courses
export const selectTeacherLoading = (state) => state.teacherExams.loading
export const selectTeacherError = (state) => state.teacherExams.error
export const selectTeacherDeliveryCounts = (state) => state.teacherExams.deliveryCounts

// Selectores puros: no guardamos contadores ni estados derivados en Firestore/Redux.
export const selectVisibleTeacherExams = createSelector(
  [selectTeacherExams, (_state, courseCode) => courseCode, (_state, _courseCode, now) => now, (_state, _courseCode, _now, archived) => Boolean(archived)],
  (exams, courseCode, now, archived) => exams
    .filter((exam) => Boolean(exam.archivado) === archived && (!courseCode || exam.cursoCodigo === courseCode))
    .map((exam) => ({ ...exam, estadoVisible: getEffectiveExamStatus(exam, now) })),
)

const searchLabels = { borrador: 'Borrador', programado: 'Programado', reprogramado: 'Reprogramado', en_curso: 'En curso', finalizado: 'Finalizado', para_corregir: 'Para corregir', cerrado: 'Cerrado' }
const normalizeSearch = (value) => String(value ?? '').toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const searchDate = (value) => value && !Number.isNaN(Date.parse(value))
  ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha'

export const selectFilteredTeacherExams = createSelector(
  [
    (state, courseCode, now, archived) => selectVisibleTeacherExams(state, courseCode, now, archived),
    (_state, _courseCode, _now, _archived, search) => search,
    (_state, _courseCode, _now, _archived, _search, field) => field,
  ],
  (exams, search, field) => {
    const needle = normalizeSearch(search.trim())
    if (!needle) return exams
    return exams.filter((exam) => {
      const values = {
        nombre: exam.nombre,
        curso: exam.cursoCodigo,
        materia: exam.materia,
        fecha: searchDate(exam.fechaInicio),
        duracion: exam.duracionMinutos ? `${exam.duracionMinutos} min` : '—',
        estado: searchLabels[exam.estadoVisible] ?? exam.estadoVisible,
      }
      return (field === 'todos' ? Object.values(values) : [values[field]])
        .some((value) => normalizeSearch(value).includes(needle))
    })
  },
)

export const selectTeacherExamCounts = createSelector([selectVisibleTeacherExams], (visible) => ({
    en_curso: visible.filter((exam) => exam.estadoVisible === 'en_curso').length,
    programado: visible.filter((exam) => ['programado', 'reprogramado'].includes(exam.estadoVisible)).length,
    finalizado: visible.filter((exam) => exam.estadoVisible === 'finalizado').length,
    para_corregir: visible.filter((exam) => exam.estadoVisible === 'para_corregir').length,
    borrador: visible.filter((exam) => exam.estadoVisible === 'borrador').length,
}))

export const selectFinalizedTeacherExams = createSelector(
  [selectTeacherExams, selectTeacherCourses, (_state, courseCode) => courseCode, (_state, _courseCode, now) => now],
  (exams, courses, courseCode, now) => {
    const assignedCodes = new Set(courses.map((course) => course.idCurso ?? course.id))
    return exams.filter((exam) => !exam.archivado && assignedCodes.has(exam.cursoCodigo) &&
      (!courseCode || exam.cursoCodigo === courseCode) && getEffectiveExamStatus(exam, now) === 'finalizado')
  },
)

export const selectFilteredFinalizedTeacherExams = createSelector(
  [
    (state, courseCode, now) => selectFinalizedTeacherExams(state, courseCode, now),
    (_state, _courseCode, _now, search) => search,
    (_state, _courseCode, _now, _search, field) => field,
  ],
  (exams, search, field) => {
    const needle = normalizeSearch(search.trim())
    if (!needle) return exams
    return exams.filter((exam) => {
      const values = { nombre: exam.nombre, curso: exam.cursoCodigo, materia: exam.materia, comision: exam.comisionId }
      return (field === 'todos' ? Object.values(values) : [values[field]])
        .some((value) => normalizeSearch(value).includes(needle))
    })
  },
)

export default teacherExamsSlice.reducer
