import { createSlice } from '@reduxjs/toolkit'
import { serializeFirestore } from '../../shared/serializeFirestore'
import { logout, sessionCleared } from '../auth/authSlice'

const examPreviewSlice = createSlice({
  name: 'examPreview',
  initialState: { draft: null },
  reducers: {
    previewOpened: {
      reducer: (state, action) => { state.draft = action.payload },
      prepare: (draft) => ({ payload: serializeFirestore(draft) }),
    },
    previewCleared: (state) => { state.draft = null },
  },
  extraReducers: (builder) => {
    builder.addCase(sessionCleared, (state) => { state.draft = null })
      .addCase(logout.fulfilled, (state) => { state.draft = null })
  },
})

export const { previewOpened, previewCleared } = examPreviewSlice.actions
export const selectExamPreviewDraft = (state) => state.examPreview.draft
export default examPreviewSlice.reducer
