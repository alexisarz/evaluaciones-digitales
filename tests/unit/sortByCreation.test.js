import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { sortNewestFirst } from '../../src/shared/sortByCreation'
import { selectAdminRows } from '../../src/features/admin/adminSlice'
import { selectVisibleStudentExams } from '../../src/features/studentExams/studentExamsSlice'
import { buildExamParticipants } from '../../src/features/teacherExams/examParticipantsRules'
import { buildCourseGradebook } from '../../src/features/teacherCourses/courseGrades'

describe('orden de creación en los listados', () => {
  it('ordena fechas de Firestore y fechas serializadas de más nuevas a más antiguas', () => {
    const old = { id: 'viejo', fechaCreacion: Timestamp.fromDate(new Date('2026-10-01T10:00:00Z')) }
    const latest = { id: 'nuevo', fechaCreacion: '2026-10-30T20:00:00.000Z' }
    const legacy = { id: 'sin-fecha' }
    const original = [legacy, old, latest]
    expect(sortNewestFirst(original).map((item) => item.id)).toEqual(['nuevo', 'viejo', 'sin-fecha'])
    expect(original.map((item) => item.id)).toEqual(['sin-fecha', 'viejo', 'nuevo'])
  })

  it('usa el inicio real del intento para entregas antiguas y conserva al final los registros sin fecha', () => {
    const rows = [
      { id: 'sin-fecha-1' },
      { id: 'anterior', fechaInicioAlumno: '2026-10-20T10:00:00Z' },
      { id: 'sin-fecha-2' },
      { id: 'reciente', fechaCreacion: '2026-10-30T10:00:00Z' },
    ]
    expect(sortNewestFirst(rows, ['fechaCreacion', 'fechaInicioAlumno']).map((item) => item.id))
      .toEqual(['reciente', 'anterior', 'sin-fecha-1', 'sin-fecha-2'])
  })

  it('aplica el orden en los paneles y en las listas de alumnos de un curso o examen', () => {
    const old = { id: '1', legajo: 1, nombre: 'Ana', apellido: 'Pérez', rol: 'alumno', fechaCreacion: '2026-10-01T10:00:00Z' }
    const latest = { id: '2', legajo: 2, nombre: 'Bruno', apellido: 'Gómez', rol: 'alumno', fechaCreacion: '2026-10-30T10:00:00Z' }
    const students = [old, latest]
    expect(selectAdminRows({ admin: { users: students, courses: [] } }, 'alumnos').map((row) => row.legajo)).toEqual(['2', '1'])
    expect(buildExamParticipants({ estado: 'borrador' }, students, []).map((row) => row.legajo)).toEqual([2, 1])
    expect(buildCourseGradebook(students, []).rows.map((row) => row.legajo)).toEqual([2, 1])
    const exams = [{ id: 'anterior', fechaCreacion: old.fechaCreacion }, { id: 'nuevo', fechaCreacion: latest.fechaCreacion }]
    expect(selectVisibleStudentExams({ studentExams: { exams, attempts: [], localDrafts: [] } }, []).map((exam) => exam.id))
      .toEqual(['nuevo', 'anterior'])
  })
})
