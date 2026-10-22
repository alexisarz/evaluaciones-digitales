import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { actualizarExamen, archivarExamen, borrarExamen, crearExamen, dateAndTimeToTimestamp, obtenerExamenesPorProfesor } from '../../services/examsService'
import { obtenerCursosPorProfesor } from '../../services/coursesService'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { getEffectiveExamStatus } from '../../utils/examWindow'
import { logout, sessionCleared } from '../auth/authSlice'

export const loadTeacherExams = createAsyncThunk('teacherExams/load', async (legajo) => {
  const [exams, courses] = await Promise.all([
    obtenerExamenesPorProfesor(legajo),
    obtenerCursosPorProfesor(legajo),
  ])
  return serializeFirestore({ exams, courses })
})

export const deleteTeacherExam = createAsyncThunk('teacherExams/delete', async ({ id, legajoProfe }) => {
  await borrarExamen(id, legajoProfe)
  return id
})

export const archiveTeacherExam = createAsyncThunk('teacherExams/archive', async ({ id, legajoProfe }) => {
  await archivarExamen(id, legajoProfe)
  return id
})

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
  initialState: { exams: [], courses: [], loading: true, error: '', requestId: null },
  reducers: { resetTeacherExams: (state) => { state.exams = []; state.courses = []; state.error = '' } },
  extraReducers: (builder) => {
    builder
      .addCase(loadTeacherExams.pending, (state, action) => { state.exams = []; state.courses = []; state.loading = true; state.error = ''; state.requestId = action.meta.requestId })
      .addCase(loadTeacherExams.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.exams = action.payload.exams
        state.courses = action.payload.courses
        state.loading = false
        state.requestId = null
      })
      .addCase(loadTeacherExams.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.requestId = null
        if (action.meta.aborted) return
        state.loading = false; state.error = 'No se pudieron cargar tus exámenes o cursos. Intentá nuevamente.'
      })
      .addCase(deleteTeacherExam.fulfilled, (state, action) => { state.exams = state.exams.filter((exam) => exam.id !== action.payload) })
      .addCase(archiveTeacherExam.fulfilled, (state, action) => {
        const exam = state.exams.find((item) => item.id === action.payload)
        if (exam) exam.archivado = true
      })
      .addCase(sessionCleared, (state) => { state.exams = []; state.courses = []; state.loading = true; state.error = ''; state.requestId = null })
      .addCase(logout.fulfilled, (state) => { state.exams = []; state.courses = []; state.loading = true; state.error = ''; state.requestId = null })
  },
})

export const { resetTeacherExams } = teacherExamsSlice.actions
export const selectTeacherExams = (state) => state.teacherExams.exams
export const selectTeacherCourses = (state) => state.teacherExams.courses
export const selectTeacherLoading = (state) => state.teacherExams.loading
export const selectTeacherError = (state) => state.teacherExams.error

// Selectores puros: no guardamos contadores ni estados derivados en Firestore/Redux.
export const selectVisibleTeacherExams = createSelector(
  [selectTeacherExams, (_state, courseCode) => courseCode, (_state, _courseCode, now) => now, (_state, _courseCode, _now, archived) => Boolean(archived)],
  (exams, courseCode, now, archived) => exams
    .filter((exam) => Boolean(exam.archivado) === archived && (!courseCode || exam.cursoCodigo === courseCode))
    .map((exam) => ({ ...exam, estadoVisible: getEffectiveExamStatus(exam, now) })),
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
    return exams.filter((exam) => assignedCodes.has(exam.cursoCodigo) &&
      (!courseCode || exam.cursoCodigo === courseCode) && getEffectiveExamStatus(exam, now) === 'finalizado')
  },
)

export default teacherExamsSlice.reducer
