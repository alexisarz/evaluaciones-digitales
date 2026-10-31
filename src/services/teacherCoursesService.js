import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { obtenerCursosPorProfesor } from './coursesService'
import { sortNewestFirst } from '../shared/sortByCreation'
import { activeStudentsFromSnapshot } from '../shared/activeEnrollment'

const enrolledStudentsQuery = (courseCode) => query(
  collection(db, 'users'), where('cursosActivos', 'array-contains', courseCode),
)

const attemptsQuery = (courseCode) => query(collection(db, 'examenesEntregados'), where('cursoCodigo', '==', courseCode))
const courseAttempts = (snapshot, legajoProfe, enrolledIds) => snapshot.docs
  .map((item) => ({ id: item.id, ...item.data() }))
  .filter((attempt) => enrolledIds.has(Number(attempt.legajoAlumno)) &&
    Number(attempt.legajoProfe) === Number(legajoProfe) && attempt.estadoEntrega === 'entregado')

export async function obtenerCursosConAlumnosPorProfesor(legajoProfe) {
  const courses = await obtenerCursosPorProfesor(legajoProfe)
  return sortNewestFirst(await Promise.all(courses.map(async (course) => {
    const code = course.idCurso ?? course.id
    const snapshot = await getDocs(enrolledStudentsQuery(code))
    return {
      ...course,
      cantidadAlumnos: activeStudentsFromSnapshot(snapshot).length,
    }
  })))
}

export async function obtenerDetalleCursoProfesor(courseCode, legajoProfe) {
  const courseSnapshot = await getDoc(doc(db, 'cursos', courseCode))
  if (!courseSnapshot.exists()) throw new Error('El curso solicitado no existe.')
  const course = { id: courseSnapshot.id, ...courseSnapshot.data() }
  if (Number(course.legajoProfe) !== Number(legajoProfe)) {
    throw new Error('No tenés acceso a este curso.')
  }

  const [studentsSnapshot, attemptsSnapshot] = await Promise.all([
    getDocs(enrolledStudentsQuery(courseCode)),
    getDocs(attemptsQuery(courseCode)),
  ])
  const students = activeStudentsFromSnapshot(studentsSnapshot)
  const enrolledIds = new Set(students.map((student) => Number(student.legajo ?? student.id)))
  const attempts = courseAttempts(attemptsSnapshot, legajoProfe, enrolledIds)
  return { course, students, attempts }
}

export function escucharEntregasCursoProfesor(courseCode, legajoProfe, students, onAttempts, onError) {
  const enrolledIds = new Set(students.map((student) => Number(student.legajo ?? student.id)))
  return onSnapshot(attemptsQuery(courseCode),
    (snapshot) => onAttempts(courseAttempts(snapshot, legajoProfe, enrolledIds)), onError)
}

export function escucharAlumnosActivosCurso(courseCode, onStudents, onError) {
  return onSnapshot(enrolledStudentsQuery(courseCode),
    (snapshot) => onStudents(activeStudentsFromSnapshot(snapshot)), onError)
}

export function escucharCantidadAlumnosCursos(codes, onCount, onError) {
  const stops = codes.map((code) => escucharAlumnosActivosCurso(code,
    (students) => onCount(code, students.length), onError))
  return () => stops.forEach((stop) => stop())
}
