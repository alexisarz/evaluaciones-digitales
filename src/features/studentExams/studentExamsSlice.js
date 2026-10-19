import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { obtenerCursosPorCodigos } from '../../services/coursesService'
import { obtenerExamenesPorCursos } from '../../services/examsService'
import { obtenerIntentosAlumno } from '../../services/examAttemptService'
import { listarBorradoresLocales } from '../../services/localExamDraft'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { logout, sessionCleared } from '../auth/authSlice'

export const loadStudentExams = createAsyncThunk('studentExams/load', async ({ legajo, cursosActivos }, { rejectWithValue }) => {
  try {
    const courses = await obtenerCursosPorCodigos(cursosActivos ?? [])
    const [exams, attempts, localDrafts] = await Promise.all([
      obtenerExamenesPorCursos(courses.map((course) => course.idCurso ?? course.id)),
      obtenerIntentosAlumno(legajo),
      listarBorradoresLocales(legajo).catch(() => []),
    ])
    return serializeFirestore({ courses, exams, attempts, localDrafts })
  } catch {
    return rejectWithValue(serializeFirestore(await listarBorradoresLocales(legajo).catch(() => [])))
  }
})

const studentExamsSlice = createSlice({
  name: 'studentExams',
  initialState: { exams: [], courses: [], attempts: [], localDrafts: [], loading: true, error: '', requestId: null },
  reducers: {
    localDraftRemoved: (state, action) => { state.localDrafts = state.localDrafts.filter((draft) => draft.id !== action.payload) },
    attemptUpserted: {
      reducer: (state, action) => {
        state.attempts = [...state.attempts.filter((attempt) => attempt.examenId !== action.payload.examenId), action.payload]
      },
      prepare: (attempt) => ({ payload: serializeFirestore(attempt) }),
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadStudentExams.pending, (state, action) => { state.exams = []; state.courses = []; state.attempts = []; state.localDrafts = []; state.loading = true; state.error = ''; state.requestId = action.meta.requestId })
      .addCase(loadStudentExams.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        Object.assign(state, action.payload, { loading: false, error: '', requestId: null })
      })
      .addCase(loadStudentExams.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.requestId = null
        if (action.meta.aborted) return
        state.localDrafts = action.payload ?? []; state.loading = false; state.error = 'No se pudieron cargar todos tus exámenes. Intentá nuevamente.'
      })
      .addCase(sessionCleared, (state) => { state.exams = []; state.courses = []; state.attempts = []; state.localDrafts = []; state.loading = true; state.error = ''; state.requestId = null })
      .addCase(logout.fulfilled, (state) => { state.exams = []; state.courses = []; state.attempts = []; state.localDrafts = []; state.loading = true; state.error = ''; state.requestId = null })
  },
})

export const { localDraftRemoved, attemptUpserted } = studentExamsSlice.actions
export const selectStudentExams = (state) => state.studentExams.exams
export const selectStudentCourses = (state) => state.studentExams.courses
export const selectStudentAttempts = (state) => state.studentExams.attempts
export const selectStudentLocalDrafts = (state) => state.studentExams.localDrafts
export const selectStudentLoading = (state) => state.studentExams.loading
export const selectStudentLoadError = (state) => state.studentExams.error

export const selectAttemptsByExam = createSelector(
  [selectStudentAttempts, selectStudentLocalDrafts],
  (attempts, localDrafts) => {
    const entries = new Map(attempts.map((attempt) => [attempt.examenId, attempt]))
    for (const draft of localDrafts) {
      const remote = entries.get(draft.examenId)
      if (remote?.estadoEntrega !== 'entregado' && (draft.estadoEntrega === 'pendiente_envio' || !remote)) {
        entries.set(draft.examenId, { ...remote, ...draft })
      }
    }
    return entries
  },
)

export const selectVisibleStudentExams = createSelector(
  [selectStudentExams, selectAttemptsByExam, (_state, cursosActivos) => cursosActivos],
  (exams, attemptsByExam, cursosActivos) => {
    const byId = new Map(exams.map((exam) => [exam.id, exam]))
    for (const attempt of attemptsByExam.values()) {
      if (!byId.has(attempt.examenId) && cursosActivos?.includes(attempt.cursoCodigo)) {
        byId.set(attempt.examenId, {
          id: attempt.examenId,
          nombre: attempt.nombreExamen,
          materia: attempt.materia,
          cursoCodigo: attempt.cursoCodigo,
          comisionId: attempt.comisionId,
          temas: [],
        })
      }
    }
    return [...byId.values()]
  },
)

export default studentExamsSlice.reducer
