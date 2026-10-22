import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import { finalizarCorreccion, guardarBorradorCorreccion, obtenerEntregaParaCorreccion, obtenerEntregasParaCorreccion } from '../../services/correctionsService'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { logout, sessionCleared } from '../auth/authSlice'

export const loadCorrectionExam = createAsyncThunk('corrections/loadExam', async ({ examId, legajoProfe }) =>
  serializeFirestore(await obtenerEntregasParaCorreccion(examId, legajoProfe)))

export const loadCorrectionDelivery = createAsyncThunk('corrections/loadDelivery', async ({ deliveryId, legajoProfe }) =>
  serializeFirestore(await obtenerEntregaParaCorreccion(deliveryId, legajoProfe)))

export const saveCorrectionDraft = createAsyncThunk('corrections/saveDraft', async ({ deliveryId, legajoProfe, correction }) =>
  serializeFirestore(await guardarBorradorCorreccion(deliveryId, legajoProfe, correction)))

export const finishCorrection = createAsyncThunk('corrections/finish', async ({ deliveryId, legajoProfe, correction }) =>
  serializeFirestore(await finalizarCorreccion(deliveryId, legajoProfe, correction)))

const initialState = { exam: null, deliveries: [], delivery: null, listLoading: false, detailLoading: false, listError: '', detailError: '', listRequestId: null, detailRequestId: null }

const upsertDelivery = (state, delivery) => {
  state.delivery = delivery
  const index = state.deliveries.findIndex((item) => item.id === delivery.id)
  if (index !== -1) state.deliveries[index] = delivery
}

const correctionsSlice = createSlice({
  name: 'corrections',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCorrectionExam.pending, (state, action) => { state.listLoading = true; state.listError = ''; state.listRequestId = action.meta.requestId; state.exam = null; state.deliveries = [] })
      .addCase(loadCorrectionExam.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return
        state.exam = action.payload.exam; state.deliveries = action.payload.deliveries; state.listLoading = false; state.listRequestId = null
      })
      .addCase(loadCorrectionExam.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return
        state.listLoading = false; state.listRequestId = null
        if (!action.meta.aborted) state.listError = action.error.message || 'No se pudieron cargar las entregas.'
      })
      .addCase(loadCorrectionDelivery.pending, (state, action) => { state.detailLoading = true; state.detailError = ''; state.detailRequestId = action.meta.requestId; state.delivery = null })
      .addCase(loadCorrectionDelivery.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return
        state.exam = action.payload.exam; state.delivery = action.payload.delivery; state.detailLoading = false; state.detailRequestId = null
      })
      .addCase(loadCorrectionDelivery.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return
        state.detailLoading = false; state.detailRequestId = null
        if (!action.meta.aborted) state.detailError = action.error.message || 'No se pudo cargar la entrega.'
      })
      .addCase(saveCorrectionDraft.fulfilled, (state, action) => { upsertDelivery(state, action.payload) })
      .addCase(finishCorrection.fulfilled, (state, action) => { upsertDelivery(state, action.payload) })
      .addCase(sessionCleared, () => initialState)
      .addCase(logout.fulfilled, () => initialState)
  },
})

export const selectCorrectionExam = (state) => state.corrections.exam
export const selectCorrectionDeliveries = (state) => state.corrections.deliveries
export const selectCorrectionDelivery = (state) => state.corrections.delivery
export const selectCorrectionListLoading = (state) => state.corrections.listLoading
export const selectCorrectionDetailLoading = (state) => state.corrections.detailLoading
export const selectCorrectionListError = (state) => state.corrections.listError
export const selectCorrectionDetailError = (state) => state.corrections.detailError
const normalize = (value) => String(value ?? '').toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
export const selectFilteredCorrectionDeliveries = createSelector(
  [selectCorrectionDeliveries, (_state, search) => search, (_state, _search, field) => field, (_state, _search, _field, status) => status],
  (deliveries, search, field, status) => deliveries.filter((delivery) => {
    if (status === 'corregido' && delivery.estadoCorreccion !== 'corregido') return false
    if (status === 'pendiente' && delivery.estadoCorreccion === 'corregido') return false
    const values = {
      nombre: `${delivery.nombreAlumno ?? ''} ${delivery.apellidoAlumno ?? ''}`,
      legajo: delivery.legajoAlumno,
      tema: delivery.tema?.nombreTema,
      estado: delivery.estadoCorreccion === 'corregido' ? 'Corregido' : 'Pendiente',
    }
    return !search.trim() || (field === 'todos' ? Object.values(values) : [values[field]]).some((value) => normalize(value).includes(normalize(search.trim())))
  }),
)
export default correctionsSlice.reducer
