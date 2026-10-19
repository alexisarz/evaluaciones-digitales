import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as authService from '../../services/authService'
import { auth } from '../../firebase'
import { serializeFirestore } from '../../shared/serializeFirestore'

export const restoreSession = createAsyncThunk('auth/restoreSession', async (firebaseUser, { rejectWithValue }) => {
  try { return serializeFirestore(await authService.getProfileFromAuthUser(firebaseUser)) }
  catch (error) {
    if (auth.currentUser?.uid === firebaseUser.uid) await authService.logout().catch(() => {})
    return rejectWithValue(error.message || 'No se pudo recuperar la sesión.')
  }
})

export const login = createAsyncThunk('auth/login', async ({ legajo, password }) =>
  serializeFirestore(await authService.login(legajo, password)))

export const registerFirstAccess = createAsyncThunk('auth/registerFirstAccess', async ({ legajo, password }) =>
  serializeFirestore(await authService.registerFirstAccess(legajo, password)))

export const logout = createAsyncThunk('auth/logout', async () => { await authService.logout() })

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, loading: true, restoreRequestId: null },
  reducers: {
    sessionCleared: (state) => { state.user = null; state.loading = false; state.restoreRequestId = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state, action) => { state.loading = true; state.restoreRequestId = action.meta.requestId })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (state.restoreRequestId !== action.meta.requestId) return
        state.user = action.payload; state.loading = false; state.restoreRequestId = null
      })
      .addCase(restoreSession.rejected, (state, action) => {
        if (state.restoreRequestId !== action.meta.requestId) return
        state.user = null; state.loading = false; state.restoreRequestId = null
      })
      .addCase(login.fulfilled, (state, action) => { state.user = action.payload; state.loading = false; state.restoreRequestId = null })
      .addCase(registerFirstAccess.fulfilled, (state, action) => { state.user = action.payload; state.loading = false; state.restoreRequestId = null })
      .addCase(logout.fulfilled, (state) => { state.user = null; state.loading = false; state.restoreRequestId = null })
  },
})

export const { sessionCleared } = authSlice.actions
export const selectUser = (state) => state.auth.user
export const selectAuthLoading = (state) => state.auth.loading
export default authSlice.reducer
