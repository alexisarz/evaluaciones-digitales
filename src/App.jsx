import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import StudentExamsPage from './pages/StudentExamsPage'
import TakeExamPage from './pages/TakeExamPage'
import ExamResultPage from './pages/ExamResultPage'
import TeacherExamsPage from './pages/TeacherExamsPage'
import NewExamPage from './pages/NewExamPage'
import AdminPage from './pages/AdminPage'
import AdminCreatePage from './pages/AdminCreatePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute allowedRoles={['alumno']} />}>
            <Route path="/alumno/misExamenes" element={<StudentExamsPage />} />
            <Route path="/alumno/realizarExamen" element={<TakeExamPage />} />
            <Route path="/alumno/examenExistoso" element={<ExamResultPage />} />
            <Route path="/alumno/errorExamen" element={<ExamResultPage failed />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['profesor']} />}>
            <Route path="/profesor/misExamenes" element={<TeacherExamsPage />} />
            <Route path="/profesor/nuevoExamen" element={<NewExamPage />} />
            <Route path="/profesor/editarExamen" element={<NewExamPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<Navigate to="/admin/panel" replace />} />
            <Route path="/admin/panel" element={<AdminPage />} />
            <Route path="/admin/nuevoAlumno" element={<AdminCreatePage type="alumno" />} />
            <Route path="/admin/nuevoProfesor" element={<AdminCreatePage type="profesor" />} />
            <Route path="/admin/nuevaMateria" element={<AdminCreatePage type="curso" />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
