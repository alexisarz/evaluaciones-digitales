import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { buildCourseGradebook, filterCourseList, filterCourseStudents } from '../../src/features/teacherCourses/courseGrades'
import teacherCoursesReducer, { courseAttemptsReceived, courseCountReceived, courseStudentsReceived, loadTeacherCourseDetail, loadTeacherCourses, selectMyCourseGradebook, selectMyCourses } from '../../src/features/teacherCourses/teacherCoursesSlice'

const students = [
  { legajo: 101, nombre: 'Ana', apellido: 'López' },
  { legajo: 102, nombre: 'Bruno', apellido: 'Díaz' },
]

const delivery = (legajoAlumno, nombreExamen, nota, options = {}) => ({
  examenId: nombreExamen,
  legajoAlumno, nombreExamen, nota, estadoEntrega: 'entregado',
  estadoCorreccion: 'corregido', notaPublicada: true, ...options,
})

describe('libro de notas del curso', () => {
  it('crea columnas solo para exámenes con nota publicada y promedia las notas disponibles', () => {
    const attempts = [
      delivery(101, 'Primer parcial', 8), delivery(101, 'Segundo parcial', 9),
      delivery(102, 'Primer parcial', 7), delivery(102, 'Segundo parcial', 8),
      delivery(102, 'Examen final', 6),
      delivery(102, 'Recuperatorio', null, { estadoCorreccion: 'pendiente', notaPublicada: false }),
    ]
    const { columns, rows } = buildCourseGradebook(students, attempts)
    expect(columns.map((column) => column.title).sort()).toEqual(['Examen final', 'Primer parcial', 'Segundo parcial'].sort())
    expect(rows[0].grades['Primer parcial']).toBe(8)
    expect(rows[0].grades['Examen final']).toBeNull()
    expect(rows[0].promedio).toBe(8.5)
    expect(rows[1].promedio).toBe(7)
  })

  it('no crea columnas vacías; una nota de 0 sí crea columna y cuenta para el promedio', () => {
    const empty = buildCourseGradebook(students, [])
    expect(empty.columns).toEqual([])
    expect(empty.rows[0].promedio).toBeNull()

    const { columns, rows } = buildCourseGradebook(students, [
      delivery(101, 'Recuperatorio', 0),
      delivery(102, 'Recuperatorio', null, { estadoCorreccion: 'pendiente', notaPublicada: false }),
    ])
    expect(columns).toEqual([{ key: 'Recuperatorio', title: 'Recuperatorio' }])
    expect(rows[0].grades.Recuperatorio).toBe(0)
    expect(rows[0].promedio).toBe(0)
    expect(rows[1].grades.Recuperatorio).toBeNull()
    expect(rows[1].pending.Recuperatorio).toBe(true)
    expect(rows[1].promedio).toBeNull()
  })

  it('mantiene separados dos exámenes con el mismo nombre y distinto ID', () => {
    const { columns, rows } = buildCourseGradebook(students, [
      delivery(101, 'Parcial', 4, { examenId: 'exam-a', comisionId: 'Comisión A' }),
      delivery(101, 'Parcial', 8, { examenId: 'exam-b', comisionId: 'Comisión B' }),
    ])
    expect(columns).toEqual([
      { key: 'exam-a', title: 'Parcial · Comisión A' },
      { key: 'exam-b', title: 'Parcial · Comisión B' },
    ])
    expect(rows[0].grades).toEqual({ 'exam-a': 4, 'exam-b': 8 })
    expect(rows[0].promedio).toBe(6)
  })

  it('actualiza las columnas y el promedio al recibir una nota publicada en Redux', () => {
    const store = configureStore({ reducer: { teacherCourses: teacherCoursesReducer } })
    const detail = { course: { id: '2C-MATE', idCurso: '2C-MATE' }, students, attempts: [] }
    store.dispatch(loadTeacherCourseDetail.pending('load-1', { courseCode: '2C-MATE' }))
    store.dispatch(loadTeacherCourseDetail.fulfilled(detail, 'load-1', { courseCode: '2C-MATE' }))
    expect(selectMyCourseGradebook(store.getState()).columns).toEqual([])
    store.dispatch(courseAttemptsReceived({ courseCode: '2C-MATE', attempts: [delivery(101, 'Parcial', 7)] }))
    expect(selectMyCourseGradebook(store.getState()).columns).toEqual([{ key: 'Parcial', title: 'Parcial' }])
    expect(selectMyCourseGradebook(store.getState()).rows[0].promedio).toBe(7)
  })

  it('filtra cursos y alumnos por texto y legajo sin depender de mayúsculas o acentos', () => {
    const courses = [{ idCurso: '2C-MATE-LUN-NOC', materia: 'Matemática' }, { idCurso: '2C-TEST', materia: 'Testing' }]
    expect(filterCourseList(courses, 'matematica')).toEqual([courses[0]])
    const { rows } = buildCourseGradebook(students, [])
    expect(filterCourseStudents(rows, 'lopez').map((row) => row.legajo)).toEqual([101])
    expect(filterCourseStudents(rows, '102').map((row) => row.legajo)).toEqual([102])
  })

  it('quita del curso al alumno dado de baja y actualiza el conteo en vivo', () => {
    const store = configureStore({ reducer: { teacherCourses: teacherCoursesReducer } })
    const course = { id: '2C-MATE', idCurso: '2C-MATE', cantidadAlumnos: 2 }
    store.dispatch(loadTeacherCourses.pending('list-1', 200045))
    store.dispatch(loadTeacherCourses.fulfilled([course], 'list-1', 200045))
    store.dispatch(loadTeacherCourseDetail.pending('detail-1', { courseCode: course.id }))
    store.dispatch(loadTeacherCourseDetail.fulfilled({ course, students, attempts: [
      delivery(101, 'Parcial', 8), delivery(102, 'Examen de Bruno', 7),
    ] }, 'detail-1', { courseCode: course.id }))

    store.dispatch(courseStudentsReceived({ courseCode: course.id, students: [students[0]] }))
    store.dispatch(courseCountReceived({ courseCode: course.id, count: 1 }))

    expect(selectMyCourses(store.getState())[0].cantidadAlumnos).toBe(1)
    expect(selectMyCourseGradebook(store.getState()).rows.map((row) => row.legajo)).toEqual([101])
    expect(selectMyCourseGradebook(store.getState()).columns.map((column) => column.title)).toEqual(['Parcial'])
  })
})
