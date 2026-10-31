import { getPublishedGrade } from '../studentExams/studentGrades'
import { sortNewestFirst } from '../../shared/sortByCreation'

const normalize = (value) => String(value ?? '').toLocaleLowerCase('es-AR')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

const examKey = (attempt) => String(attempt.examenId ?? attempt.id ?? '').trim()
const attemptTime = (attempt) => Date.parse(attempt.fechaPublicacionNota ?? attempt.fechaEntrega ?? '') || 0
const examTime = (attempt) => Date.parse(attempt.fechaInicioProgramada ?? attempt.fechaInicioAlumno ?? '') || 0

export function buildCourseGradebook(students, attempts) {
  const studentIds = new Set(students.map((student) => Number(student.legajo ?? student.id)))
  const published = attempts.filter((attempt) => studentIds.has(Number(attempt.legajoAlumno)) &&
    examKey(attempt) && getPublishedGrade(attempt) !== null)
  const byExam = new Map()
  for (const attempt of published) {
    const key = examKey(attempt)
    if (!byExam.has(key)) byExam.set(key, {
      key,
      title: String(attempt.nombreExamen ?? '').trim() || 'Examen sin nombre',
      comisionId: attempt.comisionId ?? '',
      date: examTime(attempt),
    })
  }
  const columns = [...byExam.values()].sort((a, b) => a.date - b.date || a.title.localeCompare(b.title, 'es-AR') || a.key.localeCompare(b.key))
  const titleCounts = new Map()
  for (const column of columns) titleCounts.set(column.title, (titleCounts.get(column.title) ?? 0) + 1)
  const titledColumns = columns.map((column) => ({
    key: column.key,
    title: titleCounts.get(column.title) > 1 && column.comisionId
      ? `${column.title} · ${column.comisionId}` : column.title,
  }))

  const rows = sortNewestFirst(students).map((student) => {
    const legajo = Number(student.legajo ?? student.id)
    const own = attempts.filter((attempt) => Number(attempt.legajoAlumno) === legajo)
    const latestByExam = new Map()
    const pending = {}
    for (const attempt of own) {
      const key = examKey(attempt)
      if (!byExam.has(key)) continue
      if (getPublishedGrade(attempt) === null) pending[key] = true
      else if (!latestByExam.has(key) || attemptTime(attempt) > attemptTime(latestByExam.get(key))) {
        latestByExam.set(key, attempt)
      }
    }
    const grades = Object.fromEntries(columns.map((column) => [column.key, getPublishedGrade(latestByExam.get(column.key))]))
    const scores = Object.values(grades).filter((grade) => typeof grade === 'number')
    return {
      legajo,
      nombreCompleto: `${student.nombre ?? ''} ${student.apellido ?? ''}`.trim(),
      grades,
      pending,
      promedio: scores.length ? scores.reduce((sum, grade) => sum + grade, 0) / scores.length : null,
    }
  })

  return { columns: titledColumns, rows }
}

export function filterCourseList(courses, search) {
  const needle = normalize(search)
  return needle ? courses.filter((course) => normalize(`${course.materia} ${course.idCurso ?? course.id}`).includes(needle)) : courses
}

export function filterCourseStudents(rows, search) {
  const needle = normalize(search)
  return needle ? rows.filter((row) => normalize(`${row.nombreCompleto} ${row.legajo}`).includes(needle)) : rows
}
