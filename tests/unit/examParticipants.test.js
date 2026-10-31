import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { attemptsReceived, loadExamParticipants, selectExamParticipantRows, selectFilteredExamParticipantRows, studentsReceived } from '../../src/features/teacherExams/examParticipantsSlice'
import { blankQuestionsForTopic, buildExamParticipants, participantDeliveryStatus } from '../../src/features/teacherExams/examParticipantsRules'
import { sessionCleared } from '../../src/features/auth/authSlice'
import { getExamSchedule, getExamWindowStatus } from '../../src/utils/examWindow'

const exam = {
  id: 'exam-1', estado: 'programado', legajoProfe: 200045,
  fechaInicio: '2026-11-02T19:00:00Z', toleranciaMinutos: 15, duracionMinutos: 120,
}
const students = [
  { legajo: 101, nombre: 'Ana', apellido: 'Pérez' },
  { legajo: 102, nombre: 'Bruno', apellido: 'Gómez' },
  { legajo: 103, nombre: 'Caro', apellido: 'Ruiz' },
]

describe('participantes de un examen', () => {
  it('muestra el estado sin intento antes y después del cierre de ingreso', () => {
    const before = Date.parse('2026-11-02T19:14:59Z')
    const after = Date.parse('2026-11-02T19:15:00Z')
    expect(participantDeliveryStatus(exam, null, before)).toBe('—')
    expect(participantDeliveryStatus(exam, null, after)).toBe('Ausente')
    expect(participantDeliveryStatus({ ...exam, estado: 'borrador' }, null, after)).toBe('—')
  })

  it('distingue un intento abierto, una entrega y una entrega en blanco', () => {
    const now = Date.parse('2026-11-02T19:30:00Z')
    const attempts = [
      { legajoAlumno: 101, estadoEntrega: 'en_curso' },
      { legajoAlumno: 102, estadoEntrega: 'entregado' },
      { legajoAlumno: 103, estadoEntrega: 'entregado', motivoEntrega: 'ausente' },
    ]
    const rows = buildExamParticipants(exam, students, attempts, now)
    expect(rows.map((row) => row.estadoEntrega)).toEqual(['En curso', 'Entregado', 'Ausente'])
  })

  it('actualiza el listado desde Redux y permite buscar por nombre, legajo y estado', () => {
    const store = configureStore({ reducer: { examParticipants: reducer } })
    store.dispatch(loadExamParticipants.pending('load-1', { examId: exam.id }))
    store.dispatch(loadExamParticipants.fulfilled({ exam, students }, 'load-1', { examId: exam.id }))
    store.dispatch(attemptsReceived({ examId: exam.id, attempts: [
      { id: 'a', examenId: exam.id, legajoProfe: 200045, legajoAlumno: 101, estadoEntrega: 'entregado' },
    ] }))
    const now = Date.parse('2026-11-02T19:30:00Z')
    expect(selectExamParticipantRows(store.getState(), now)).toHaveLength(3)
    expect(selectFilteredExamParticipantRows(store.getState(), now, 'perez', 'todos').map((row) => row.legajo)).toEqual([101])
    expect(selectFilteredExamParticipantRows(store.getState(), now, '', 'Ausente').map((row) => row.legajo)).toEqual([102, 103])
    store.dispatch(studentsReceived({ examId: exam.id, students: students.slice(0, 2) }))
    expect(selectExamParticipantRows(store.getState(), now).map((row) => row.legajo)).toEqual([101, 102])
    store.dispatch(sessionCleared())
    expect(store.getState().examParticipants.students).toEqual([])
  })

  it('prepara el tema elegido para un ausente con todas las respuestas vacías', () => {
    const topic = { nombreTema: 'Tema B', preguntas: [
      { idPregunta: 1, consigna: 'Explicá el caso', tipo: 'Texto', puntaje: 4 },
      { idPregunta: 2, consigna: 'Construí una tabla', tipo: 'Tabla de decisión', puntaje: 6 },
    ] }
    const blank = blankQuestionsForTopic(topic)
    expect(blank.preguntas.map((question) => question.puntajeMaximo)).toEqual([4, 6])
    expect(blank.respuestas).toEqual([
      { idPregunta: 1, tipo: 'Texto', respuestaTexto: '' },
      { idPregunta: 2, tipo: 'Tabla de decisión', respuestaTexto: '' },
    ])
  })

  it('usa la finalización anticipada como límite real del examen', () => {
    const forced = { ...exam, estado: 'finalizado', fechaFinForzada: '2026-11-02T19:05:00Z' }
    const after = Date.parse('2026-11-02T19:05:01Z')
    expect(getExamSchedule(forced).endMs).toBe(Date.parse('2026-11-02T19:05:00Z'))
    expect(getExamWindowStatus(forced, after).status).toBe('expired')
    expect(participantDeliveryStatus(forced, null, after)).toBe('Ausente')
  })
})
