import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import SessionBootstrap from './features/auth/SessionBootstrap'
import ProtectedRoute from './components/ProtectedRoute'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const StudentExamsPage = lazy(() => import('./pages/StudentExamsPage'))
const TakeExamPage = lazy(() => import('./pages/TakeExamPage'))
const ExamResultPage = lazy(() => import('./pages/ExamResultPage'))
const TeacherExamsPage = lazy(() => import('./pages/TeacherExamsPage'))
const NewExamPage = lazy(() => import('./pages/NewExamPage'))
const ExamPreviewPage = lazy(() => import('./pages/ExamPreviewPage'))
const CorrectionsPage = lazy(() => import('./pages/CorrectionsPage'))
const CorrectionAttemptsPage = lazy(() => import('./pages/CorrectionAttemptsPage'))
const CorrectionDetailPage = lazy(() => import('./pages/CorrectionDetailPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminCreatePage = lazy(() => import('./pages/AdminCreatePage'))
const AdminEditPage = lazy(() => import('./pages/AdminEditPage'))

export default function App() {
  return (
    <SessionBootstrap>
      <BrowserRouter>
        <Suspense fallback={<p className="status">Cargando pantalla…</p>}>
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
            <Route path="/profesor/examenesArchivados" element={<TeacherExamsPage archived />} />
            <Route path="/profesor/nuevoExamen" element={<NewExamPage />} />
            <Route path="/profesor/editarExamen" element={<NewExamPage />} />
            <Route path="/profesor/examPreview" element={<ExamPreviewPage />} />
            <Route path="/profesor/correcciones" element={<CorrectionsPage />} />
            <Route path="/profesor/corregirExamen" element={<CorrectionAttemptsPage />} />
            <Route path="/profesor/corregirExamen/examenAlumno" element={<CorrectionDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<Navigate to="/admin/panel" replace />} />
            <Route path="/admin/panel" element={<AdminPage />} />
            <Route path="/admin/nuevoAlumno" element={<AdminCreatePage type="alumno" />} />
            <Route path="/admin/nuevoProfesor" element={<AdminCreatePage type="profesor" />} />
            <Route path="/admin/nuevaMateria" element={<AdminCreatePage type="curso" />} />
            <Route path="/admin/panel/editarAlumno" element={<AdminEditPage type="alumno" />} />
            <Route path="/admin/panel/editarProfesor" element={<AdminEditPage type="profesor" />} />
            <Route path="/admin/panel/editarMateria" element={<AdminEditPage type="curso" />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </SessionBootstrap>
  )
}
