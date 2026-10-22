import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import teacherExamsReducer from '../features/teacherExams/teacherExamsSlice'
import studentExamsReducer from '../features/studentExams/studentExamsSlice'
import adminReducer from '../features/admin/adminSlice'
import examPreviewReducer from '../features/teacherExams/examPreviewSlice'
import correctionsReducer from '../features/corrections/correctionsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    teacherExams: teacherExamsReducer,
    examPreview: examPreviewReducer,
    corrections: correctionsReducer,
    studentExams: studentExamsReducer,
    admin: adminReducer,
  },
})
