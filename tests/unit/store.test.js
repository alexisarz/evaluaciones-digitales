import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import authReducer, { login, logout, sessionCleared } from '../../src/features/auth/authSlice'
import teacherReducer, { selectTeacherExamCounts, selectVisibleTeacherExams } from '../../src/features/teacherExams/teacherExamsSlice'
import studentReducer, { attemptUpserted, localDraftRemoved, selectAttemptsByExam } from '../../src/features/studentExams/studentExamsSlice'
import adminReducer, { coursesReceived, selectFilteredAdminRows, usersReceived } from '../../src/features/admin/adminSlice'
import { serializeFirestore } from '../../src/shared/serializeFirestore'

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
    store.dispatch(usersReceived([{ id: '1', legajo: 1, nombre: 'Ana', apellido: 'Pérez', rol: 'alumno', activo: true, contrasenaActiva: true, cursosActivos: ['2A-TEST'] }]))
    store.dispatch(coursesReceived([]))
    const fields = [['all', 'Todos'], ['legajo', 'Legajo'], ['nombre', 'Nombre'], ['curso', 'Curso'], ['estado', 'Estado']]
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', '2A-TEST', 'curso', fields)).toHaveLength(1)
    expect(selectFilteredAdminRows(store.getState(), 'alumnos', '2A-TEST', 'nombre', fields)).toHaveLength(0)
  })
})
