import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import teacherExamsReducer from '../features/teacherExams/teacherExamsSlice'
import studentExamsReducer from '../features/studentExams/studentExamsSlice'
import adminReducer from '../features/admin/adminSlice'
import examPreviewReducer from '../features/teacherExams/examPreviewSlice'
import correctionsReducer from '../features/corrections/correctionsSlice'
import teacherCoursesReducer from '../features/teacherCourses/teacherCoursesSlice'
import examParticipantsReducer from '../features/teacherExams/examParticipantsSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    teacherExams: teacherExamsReducer,
    examPreview: examPreviewReducer,
    corrections: correctionsReducer,
    teacherCourses: teacherCoursesReducer,
    examParticipants: examParticipantsReducer,
    studentExams: studentExamsReducer,
    admin: adminReducer,
  },
})
