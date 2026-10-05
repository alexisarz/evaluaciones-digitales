import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import StudentExamsPage from './pages/StudentExamsPage'
import TeacherExamsPage from './pages/TeacherExamsPage'
import NewExamPage from './pages/NewExamPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute allowedRoles={['alumno']} />}>
            <Route path="/alumno/misExamenes" element={<StudentExamsPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['profesor']} />}>
            <Route path="/profesor/misExamenes" element={<TeacherExamsPage />} />
            <Route path="/profesor/nuevoExamen" element={<NewExamPage />} />
            <Route path="/profesor/editarExamen" element={<NewExamPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
