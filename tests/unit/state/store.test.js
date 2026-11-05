import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import authReducer, { login, logout, sessionCleared } from '../../../src/features/auth/authSlice'
import teacherReducer, { archiveTeacherExam, archiveTeacherExams, deliveryCountsReceived, moveTeacherExamsToFinalArchive, selectFilteredFinalizedTeacherExams, selectFilteredTeacherExams, selectTeacherExamCounts, selectFinalizedTeacherExams, selectVisibleTeacherExams } from '../../../src/features/teacherExams/teacherExamsSlice'
import studentReducer, { attemptUpserted, localDraftRemoved, selectAttemptsByExam, selectVisibleStudentExams } from '../../../src/features/studentExams/studentExamsSlice'
import adminReducer, { coursesReceived, selectFilteredAdminRows, usersReceived } from '../../../src/features/admin/adminSlice'
import { serializeFirestore } from '../../../src/shared/serializeFirestore'

const makeStore = () => configureStore({ reducer: { auth: authReducer, teacherExams: teacherReducer, studentExams: studentReducer, admin: adminReducer } })

describe('store y datos serializables', () => {
  it('convierte Timestamp de Firestore antes de entrar al estado', () => {
    const result = serializeFirestore({ fechaInicio: { toDate: () => new Date('2026-10-19T19:00:00Z') }, temas: [{ nombreTema: 'Tema A' }] })
    expect(result.fechaInicio).toBe('2026-10-19T19:00:00.000Z')
    expect(result.temas[0].nombreTema).toBe('Tema A')
  })

  it('guarda la sesión y elimina los datos académicos al salir', () => {
    const store = makeStore()
    store.dispatch(login.fulfilled({ legajo: 200045, rol: 'profesor' }, 'login', {}))
    store.dispatch(usersReceived([{ legajo: 1098765, rol: 'alumno' }]))
    expect(store.getState().auth.user.rol).toBe('profesor')
    store.dispatch(logout.fulfilled(undefined, 'logout'))
    expect(store.getState().auth.user).toBeNull()
    expect(store.getState().admin.users).toEqual([])
    store.dispatch(sessionCleared())
    expect(store.getState().auth.loading).toBe(false)
  })

  it('ignora respuestas antiguas después de cerrar sesión', () => {
    const store = makeStore()
    store.dispatch({ type: 'teacherExams/load/pending', meta: { requestId: 'old-request' } })
    store.dispatch(sessionCleared())
    store.dispatch({ type: 'teacherExams/load/fulfilled', meta: { requestId: 'old-request' }, payload: { exams: [{ id: 'private' }], courses: [] } })
    expect(store.getState().teacherExams.exams).toEqual([])
  })

  it('calcula estados del profesor sin modificar el examen guardado', () => {
    const now = Date.parse('2026-10-19T19:30:00Z')
    const state = { teacherExams: { exams: [
      { id: 'a', cursoCodigo: '2A-TEST', estado: 'programado', fechaInicio: '2026-10-19T19:00:00Z', duracionMinutos: 120 },
      { id: 'b', cursoCodigo: '2A-TEST', estado: 'borrador' },
    ] } }
    expect(selectVisibleTeacherExams(state, '2A-TEST', now)[0].estadoVisible).toBe('en_curso')
    expect(selectTeacherExamCounts(state, '2A-TEST', now)).toMatchObject({ en_curso: 1, borrador: 1 })
    expect(state.teacherExams.exams[0].estado).toBe('programado')
  })

  it('busca exámenes del profesor por campo, sin perder el filtro de curso ni archivados', () => {
    const now = Date.parse('2026-10-29T19:30:00Z')
    const state = { teacherExams: { exams: [
      { id: 'a', nombre: 'Recuperatorio', cursoCodigo: '2A-TEST', materia: 'Álgebra', estado: 'programado', fechaInicio: '2026-10-29T19:00:00Z', duracionMinutos: 120 },
      { id: 'b', nombre: 'Parcial 1', cursoCodigo: '3B-PROG', materia: 'Programación', estado: 'borrador', archivado: false },
      { id: 'c', nombre: 'Final', cursoCodigo: '2A-TEST', materia: 'Álgebra', estado: 'cerrado', archivado: true },
    ] } }

    expect(selectFilteredTeacherExams(state, '', now, false, 'algebra', 'materia').map((exam) => exam.id)).toEqual(['a'])
    expect(selectFilteredTeacherExams(state, '', now, false, 'en CURSO', 'estado').map((exam) => exam.id)).toEqual(['a'])
    expect(selectFilteredTeacherExams(state, '2A-TEST', now, false, 'parcial', 'todos')).toHaveLength(0)
    expect(selectFilteredTeacherExams(state, '', now, true, 'final', 'nombre').map((exam) => exam.id)).toEqual(['c'])
    expect(selectTeacherExamCounts(state, '2A-TEST', now, false).en_curso).toBe(1)
  })

  it('filtra en tiempo real los exámenes de corrección y actualiza los contadores de entregas', () => {
    const store = makeStore()
    const now = Date.parse('2026-10-29T20:00:00Z')
    store.dispatch({ type: 'teacherExams/load/pending', meta: { requestId: 'load' } })
    store.dispatch({ type: 'teacherExams/load/fulfilled', meta: { requestId: 'load' }, payload: {
      exams: [
        { id: 'a', nombre: 'Final Álgebra', materia: 'Álgebra', cursoCodigo: '2A-TEST', comisionId: 'Comisión A', estado: 'programado', fechaInicio: '2026-10-29T16:00:00Z', duracionMinutos: 120 },
        { id: 'b', nombre: 'Final Física', materia: 'Física', cursoCodigo: '3B-FIS', comisionId: 'Comisión B', estado: 'programado', fechaInicio: '2026-10-29T16:00:00Z', duracionMinutos: 120 },
      ], courses: [{ idCurso: '2A-TEST' }, { idCurso: '3B-FIS' }], deliveryCounts: { a: 1 },
    } })
    expect(selectFilteredFinalizedTeacherExams(store.getState(), '', now, 'algebra', 'materia').map((exam) => exam.id)).toEqual(['a'])
    expect(selectFilteredFinalizedTeacherExams(store.getState(), '3B-FIS', now, 'comision b', 'comision').map((exam) => exam.id)).toEqual(['b'])
    store.dispatch(deliveryCountsReceived({ a: 3, b: 1 }))
    expect(store.getState().teacherExams.deliveryCounts).toEqual({ a: 3, b: 1 })
  })

  it('al archivar desde Correcciones, retira el examen de esa lista y lo muestra en Archivados', () => {
    const store = makeStore()
    const now = Date.parse('2026-10-29T20:00:00Z')
    store.dispatch({ type: 'teacherExams/load/pending', meta: { requestId: 'load' } })
    store.dispatch({ type: 'teacherExams/load/fulfilled', meta: { requestId: 'load' }, payload: {
      exams: [{ id: 'a', cursoCodigo: '2A-TEST', estado: 'finalizado', archivado: false }],
      courses: [{ idCurso: '2A-TEST' }], deliveryCounts: {},
    } })
    expect(selectFinalizedTeacherExams(store.getState(), '', now).map((exam) => exam.id)).toEqual(['a'])
    store.dispatch(archiveTeacherExam.fulfilled('a', 'archive', { id: 'a', legajoProfe: 200045 }))
    expect(selectFinalizedTeacherExams(store.getState(), '', now)).toEqual([])
    expect(selectVisibleTeacherExams(store.getState(), '', now, true).map((exam) => exam.id)).toEqual(['a'])
  })

  it('archiva varios exámenes juntos y conserva fuera del archivo los demás estados', () => {
    const store = makeStore()
    const now = Date.parse('2026-10-29T20:00:00Z')
    store.dispatch({ type: 'teacherExams/load/pending', meta: { requestId: 'load' } })
    store.dispatch({ type: 'teacherExams/load/fulfilled', meta: { requestId: 'load' }, payload: {
      exams: [
        { id: 'a', cursoCodigo: '2A-TEST', estado: 'finalizado', archivado: false },
        { id: 'b', cursoCodigo: '2A-TEST', estado: 'finalizado', archivado: false },
        { id: 'c', cursoCodigo: '2A-TEST', estado: 'borrador', archivado: false },
      ], courses: [{ idCurso: '2A-TEST' }], deliveryCounts: { a: 2, b: 1 },
    } })
    store.dispatch(archiveTeacherExams.fulfilled(['a', 'b'], 'archive-many', { ids: ['a', 'b'], legajoProfe: 200045 }))
    expect(selectVisibleTeacherExams(store.getState(), '', now, true).map((exam) => exam.id)).toEqual(['a', 'b'])
    expect(selectVisibleTeacherExams(store.getState(), '', now, false).map((exam) => exam.id)).toEqual(['c'])
    expect(selectFinalizedTeacherExams(store.getState(), '', now)).toEqual([])
    expect(store.getState().teacherExams.deliveryCounts).toEqual({ a: 2, b: 1 })
  })

  it('retira los exámenes trasladados de las vistas del profesor y sus contadores', () => {
    const store = makeStore()
    store.dispatch({ type: 'teacherExams/load/pending', meta: { requestId: 'load' } })
    store.dispatch({ type: 'teacherExams/load/fulfilled', meta: { requestId: 'load' }, payload: {
      exams: [
        { id: 'a', nombre: 'Final A', estado: 'finalizado', archivado: true },
        { id: 'b', nombre: 'Final B', estado: 'finalizado', archivado: true },
      ], courses: [], deliveryCounts: { a: 3, b: 1 },
    } })
    store.dispatch(moveTeacherExamsToFinalArchive.fulfilled(['a'], 'move', { ids: ['a'], legajoProfe: 200045 }))
    expect(store.getState().teacherExams.exams.map((exam) => exam.id)).toEqual(['b'])
    expect(store.getState().teacherExams.deliveryCounts).toEqual({ b: 1 })
  })

  it('mantiene visible una entrega corregida aunque se retire el examen y cambie el curso activo', () => {
    const store = makeStore()
    store.dispatch(attemptUpserted({ examenId: 'archivado', nombreExamen: 'Parcial 1', cursoCodigo: 'curso-anterior', estadoEntrega: 'entregado', estadoCorreccion: 'corregido', nota: 8, notaPublicada: true }))
    expect(selectVisibleStudentExams(store.getState(), ['curso-nuevo']).map((exam) => exam.id)).toEqual(['archivado'])
  })

  it('prioriza una entrega local pendiente y permite retirarla tras confirmar', () => {
    const store = makeStore()
    store.dispatch(attemptUpserted({ id: 'remote', examenId: 'ex1', estadoEntrega: 'en_curso' }))
    store.dispatch({ type: 'studentExams/load/pending', meta: { requestId: 'load-1' } })
    store.dispatch({ type: 'studentExams/load/fulfilled', meta: { requestId: 'load-1' }, payload: { exams: [], courses: [], attempts: [{ id: 'remote', examenId: 'ex1', estadoEntrega: 'en_curso' }], localDrafts: [{ id: 'local', examenId: 'ex1', estadoEntrega: 'pendiente_envio' }] } })
    expect(selectAttemptsByExam(store.getState()).get('ex1').estadoEntrega).toBe('pendiente_envio')
    store.dispatch(localDraftRemoved('local'))
    expect(selectAttemptsByExam(store.getState()).get('ex1').estadoEntrega).toBe('en_curso')
  })

  it('filtra alumnos por campo sin confundir cursos con nombres', () => {
    const store = makeStore()
    store.dispatch(usersReceived([{ id: '1', legajo: 1, nombre: 'Ana', apellido: 'Pérez', rol: 'alumno', activo: true, contrasenaActiva: true, cursosActivos: ['2A-TEST', 'CURSO-BORRADO'] }]))
    store.dispatch(coursesReceived([]))
    const fields = [['all', 'Todos'], ['legajo', 'Legajo'], ['nombre', 'Nombre'], ['curso', 'Curso'], ['estado', 'Estado']]
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', '2A-TEST', 'curso', fields)).toHaveLength(0)
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', 'CURSO-BORRADO', 'curso', fields)).toHaveLength(0)
    store.dispatch(coursesReceived([{ id: '2A-TEST', idCurso: '2A-TEST' }]))
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', '2A-TEST', 'curso', fields)).toHaveLength(1)
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', 'CURSO-BORRADO', 'curso', fields)).toHaveLength(0)
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', '2A-TEST', 'nombre', fields)).toHaveLength(0)
    store.dispatch(usersReceived([{ id: '1', legajo: 1, nombre: 'Ana', apellido: 'Pérez', rol: 'alumno', activo: false, cursosActivos: ['2A-TEST'] }]))
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', '2A-TEST', 'curso', fields)).toHaveLength(0)
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', 'Inscripción suspendida', 'curso', fields)).toHaveLength(1)
  })
})
