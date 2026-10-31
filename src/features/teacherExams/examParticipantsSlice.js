import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { crearEntregaAusente, escucharEstadoExamen, escucharIntentosExamen, finalizarExamenAnticipadamente, obtenerParticipantesExamen } from '../../services/examParticipantsService'
import { escucharAlumnosActivosCurso } from '../../services/teacherCoursesService'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { logout, sessionCleared } from '../auth/authSlice'
import { buildExamParticipants, filterExamParticipants } from './examParticipantsRules'

export const loadExamParticipants = createAsyncThunk('examParticipants/load', async ({ examId, legajoProfe }) =>
  serializeFirestore(await obtenerParticipantesExamen(examId, legajoProfe)))

export const createAbsentDelivery = createAsyncThunk('examParticipants/createAbsent', async ({ examId, legajoAlumno, nombreTema, legajoProfe }) =>
  serializeFirestore(await crearEntregaAusente(examId, legajoAlumno, nombreTema, legajoProfe)))

export const forceFinishExam = createAsyncThunk('examParticipants/forceFinish', async ({ examId, legajoProfe }) =>
  serializeFirestore(await finalizarExamenAnticipadamente(examId, legajoProfe)))

const initialState = { exam: null, students: [], attempts: [], loading: false, attemptsReady: false, error: '', requestId: null }

const examParticipantsSlice = createSlice({
  name: 'examParticipants',
  initialState,
  reducers: {
    studentsReceived: (state, action) => {
      if (state.exam?.id === action.payload.examId) state.students = action.payload.students
    },
    studentsFailed: (state, action) => {
      if (state.exam?.id === action.payload.examId) state.error = 'No se pudo actualizar el listado de alumnos en tiempo real.'
    },
    examReceived: (state, action) => {
      if (state.exam?.id === action.payload.id) state.exam = action.payload
    },
    examFailed: (state, action) => {
      if (state.exam?.id === action.payload.examId) state.error = 'No se pudo actualizar el estado del examen en tiempo real.'
    },
    attemptsReceived: (state, action) => {
      if (state.exam?.id !== action.payload.examId) return
      state.attempts = action.payload.attempts
      state.attemptsReady = true
      state.error = ''
    },
    attemptsFailed: (state, action) => {
      if (state.exam?.id === action.payload.examId) state.error = 'No se pudieron actualizar las entregas en tiempo real.'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadExamParticipants.pending, (state, action) => {
        state.exam = null; state.students = []; state.attempts = []; state.loading = true
        state.attemptsReady = false; state.error = ''; state.requestId = action.meta.requestId
      })
      .addCase(loadExamParticipants.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.exam = action.payload.exam; state.students = action.payload.students
        state.loading = false; state.requestId = null
      })
      .addCase(loadExamParticipants.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.loading = false; state.requestId = null
        if (!action.meta.aborted) state.error = action.error.message || 'No se pudieron cargar los alumnos del examen.'
      })
      .addCase(createAbsentDelivery.fulfilled, (state, action) => {
        if (state.exam?.id !== action.payload.examenId) return
        state.attempts = [...state.attempts.filter((item) => item.id !== action.payload.id), action.payload]
      })
      .addCase(forceFinishExam.fulfilled, (state, action) => {
        if (state.exam?.id === action.payload.examId) {
          state.exam.estado = 'finalizado'
          state.exam.fechaFinForzada = action.payload.fechaFinForzada
        }
      })
      .addCase(sessionCleared, () => initialState)
      .addCase(logout.fulfilled, () => initialState)
  },
})

export const { studentsReceived, studentsFailed, examReceived, examFailed, attemptsReceived, attemptsFailed } = examParticipantsSlice.actions
export const subscribeExamParticipantStudents = (dispatch, examId, courseCode) =>
  escucharAlumnosActivosCurso(courseCode,
    (students) => dispatch(studentsReceived({ examId, students: serializeFirestore(students) })),
    () => dispatch(studentsFailed({ examId })))
export const subscribeExamParticipantExam = (dispatch, examId) =>
  escucharEstadoExamen(examId, (exam) => dispatch(examReceived(serializeFirestore(exam))),
    () => dispatch(examFailed({ examId })))
export const subscribeExamParticipantAttempts = (dispatch, examId) =>
  escucharIntentosExamen(examId,
    (attempts) => dispatch(attemptsReceived({ examId, attempts: serializeFirestore(attempts) })),
    () => dispatch(attemptsFailed({ examId })))

export const selectParticipantExam = (state) => state.examParticipants.exam
export const selectParticipantsLoading = (state) => state.examParticipants.loading
export const selectParticipantsReady = (state) => state.examParticipants.attemptsReady
export const selectParticipantsError = (state) => state.examParticipants.error
export const selectHasOpenExamAttempts = createSelector(
  [(state) => state.examParticipants.attempts], (attempts) => attempts.some((item) => item.estadoEntrega === 'en_curso'),
)
const selectStudents = (state) => state.examParticipants.students
const selectAttempts = (state) => state.examParticipants.attempts

export const selectExamParticipantRows = createSelector(
  [selectParticipantExam, selectStudents, selectAttempts, (_state, now) => now],
  (exam, students, attempts, now) => {
    if (!exam) return []
    const studentIds = new Set(students.map((item) => Number(item.legajo ?? item.id)))
    const relevant = attempts.filter((item) => item.examenId === exam.id &&
      Number(item.legajoProfe) === Number(exam.legajoProfe) && studentIds.has(Number(item.legajoAlumno)))
    return buildExamParticipants(exam, students, relevant, now)
  },
)

export const selectFilteredExamParticipantRows = createSelector(
  [(state, now) => selectExamParticipantRows(state, now), (_state, _now, search) => search, (_state, _now, _search, status) => status],
  filterExamParticipants,
)

export default examParticipantsSlice.reducer
