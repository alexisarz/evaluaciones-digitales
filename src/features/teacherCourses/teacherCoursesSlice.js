import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { escucharAlumnosActivosCurso, escucharCantidadAlumnosCursos, escucharEntregasCursoProfesor, obtenerCursosConAlumnosPorProfesor, obtenerDetalleCursoProfesor } from '../../services/teacherCoursesService'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { logout, sessionCleared } from '../auth/authSlice'
import { buildCourseGradebook, filterCourseList, filterCourseStudents } from './courseGrades'

export const loadTeacherCourses = createAsyncThunk('teacherCourses/loadList', async (legajoProfe) =>
  serializeFirestore(await obtenerCursosConAlumnosPorProfesor(legajoProfe)))

export const loadTeacherCourseDetail = createAsyncThunk('teacherCourses/loadDetail', async ({ courseCode, legajoProfe }) =>
  serializeFirestore(await obtenerDetalleCursoProfesor(courseCode, legajoProfe)))

const initialState = {
  courses: [], listLoading: true, listError: '', listRequestId: null,
  detail: null, detailLoading: false, detailError: '', detailRequestId: null,
}

const teacherCoursesSlice = createSlice({
  name: 'teacherCourses',
  initialState,
  reducers: {
    courseCountReceived: (state, action) => {
      const course = state.courses.find((item) => (item.idCurso ?? item.id) === action.payload.courseCode)
      if (course) course.cantidadAlumnos = action.payload.count
    },
    courseStudentsReceived: (state, action) => {
      if (state.detail?.course?.id === action.payload.courseCode) state.detail.students = action.payload.students
    },
    courseAttemptsReceived: (state, action) => {
      if (state.detail?.course?.id === action.payload.courseCode) state.detail.attempts = action.payload.attempts
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadTeacherCourses.pending, (state, action) => {
        state.courses = []; state.listLoading = true; state.listError = ''; state.listRequestId = action.meta.requestId
      })
      .addCase(loadTeacherCourses.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return
        state.courses = action.payload; state.listLoading = false; state.listRequestId = null
      })
      .addCase(loadTeacherCourses.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return
        state.listRequestId = null
        if (action.meta.aborted) return
        state.listLoading = false; state.listError = 'No se pudieron cargar tus cursos. Intentá nuevamente.'
      })
      .addCase(loadTeacherCourseDetail.pending, (state, action) => {
        state.detail = null; state.detailLoading = true; state.detailError = ''; state.detailRequestId = action.meta.requestId
      })
      .addCase(loadTeacherCourseDetail.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return
        state.detail = action.payload; state.detailLoading = false; state.detailRequestId = null
      })
      .addCase(loadTeacherCourseDetail.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return
        state.detailRequestId = null
        if (action.meta.aborted) return
        state.detailLoading = false
        state.detailError = action.error.message || 'No se pudo cargar este curso.'
      })
      .addCase(sessionCleared, () => initialState)
      .addCase(logout.fulfilled, () => initialState)
  },
})

export const selectMyCourses = (state) => state.teacherCourses.courses
export const { courseCountReceived, courseStudentsReceived, courseAttemptsReceived } = teacherCoursesSlice.actions
export const subscribeTeacherCourseCounts = (dispatch, codes, onError) =>
  escucharCantidadAlumnosCursos(codes,
    (courseCode, count) => dispatch(courseCountReceived({ courseCode, count })), onError)
export const subscribeTeacherCourseStudents = (dispatch, courseCode, onError) =>
  escucharAlumnosActivosCurso(courseCode,
    (students) => dispatch(courseStudentsReceived({ courseCode, students: serializeFirestore(students) })), onError)
export const subscribeTeacherCourseAttempts = (dispatch, courseCode, legajoProfe, students, onError) =>
  escucharEntregasCursoProfesor(courseCode, legajoProfe, students,
    (attempts) => dispatch(courseAttemptsReceived({ courseCode, attempts: serializeFirestore(attempts) })), onError)
export const selectMyCoursesLoading = (state) => state.teacherCourses.listLoading
export const selectMyCoursesError = (state) => state.teacherCourses.listError
export const selectMyCourseDetail = (state) => state.teacherCourses.detail
export const selectMyCourseDetailLoading = (state) => state.teacherCourses.detailLoading
export const selectMyCourseDetailError = (state) => state.teacherCourses.detailError

export const selectFilteredMyCourses = createSelector(
  [selectMyCourses, (_state, search) => search], filterCourseList,
)
export const selectMyCourseGradebook = createSelector(
  [selectMyCourseDetail], (detail) => detail ? buildCourseGradebook(detail.students, detail.attempts) : { columns: [], rows: [] },
)
export const selectFilteredMyCourseStudents = createSelector(
  [selectMyCourseGradebook, (_state, search) => search], (gradebook, search) => filterCourseStudents(gradebook.rows, search),
)

export default teacherCoursesSlice.reducer
