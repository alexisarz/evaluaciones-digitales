import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { obtenerCorreccionPublicadaAlumno } from '../../../src/services/examAttemptService'
import studentReducer, { loadPublishedStudentCorrection, selectAttemptsByExam, selectStudentReview, studentAttemptsReceived } from '../../../src/features/studentExams/studentExamsSlice'
import { sessionCleared } from '../../../src/features/auth/authSlice'
import { getPublishedGrade } from '../../../src/features/studentExams/studentGrades'

const { records } = vi.hoisted(() => ({ records: new Map() }))

vi.mock('../../../src/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    collection: (_db, path) => ({ path }),
    doc: (_db, collection, id) => ({ path: `${collection}/${id}` }),
    getDoc: async (reference) => ({
      id: reference.path.split('/').at(-1),
      exists: () => records.has(reference.path),
      data: () => records.get(reference.path),
    }),
  }
})

const published = {
  examenId: 'parcial-1', legajoAlumno: 123, estadoEntrega: 'entregado',
  estadoCorreccion: 'corregido', notaPublicada: true, nota: 0,
  nombreExamen: 'Parcial 1',
  preguntas: [{ idPregunta: 1, consigna: 'Consigna', puntajeMaximo: 10 }],
  respuestas: [{ idPregunta: 1, respuestaTexto: 'Respuesta' }],
  correccion: [{ idPregunta: 1, puntaje: 0, comentario: 'Revisar el desarrollo' }],
  incidentes: ['Incidencia reservada para el profesor'],
}

describe('consulta de corrección por el alumno', () => {
  beforeEach(() => records.clear())

  it('devuelve la nota y los comentarios publicados para el legajo propio', async () => {
    records.set('examenesEntregados/parcial-1_123', published)
    const review = await obtenerCorreccionPublicadaAlumno('parcial-1', 123)
    expect(review).toMatchObject({ nota: 0, correccion: [{ comentario: 'Revisar el desarrollo' }] })
    expect(review).not.toHaveProperty('incidentes')
    await expect(obtenerCorreccionPublicadaAlumno('parcial-1', 456)).rejects.toThrow('No hay una corrección publicada')
  })

  it('bloquea borradores y notas sin publicar, aunque se abra la URL directamente', async () => {
    records.set('examenesEntregados/parcial-1_123', { ...published, estadoCorreccion: 'pendiente' })
    await expect(obtenerCorreccionPublicadaAlumno('parcial-1', 123)).rejects.toThrow('No hay una corrección publicada')
    records.set('examenesEntregados/parcial-1_123', { ...published, notaPublicada: false })
    await expect(obtenerCorreccionPublicadaAlumno('parcial-1', 123)).rejects.toThrow('No hay una corrección publicada')
  })

  it('limpia la corrección publicada del estado al cerrar sesión', () => {
    const store = configureStore({ reducer: { studentExams: studentReducer } })
    store.dispatch(loadPublishedStudentCorrection.pending('review-1', { examId: 'parcial-1', legajo: 123 }))
    store.dispatch(loadPublishedStudentCorrection.fulfilled(published, 'review-1', { examId: 'parcial-1', legajo: 123 }))
    expect(selectStudentReview(store.getState())?.nota).toBe(0)
    store.dispatch(sessionCleared())
    expect(selectStudentReview(store.getState())).toBeNull()
  })

  it('refleja una nota recién publicada sin recargar el listado', () => {
    const store = configureStore({ reducer: { studentExams: studentReducer } })
    store.dispatch(studentAttemptsReceived([{ ...published, estadoCorreccion: 'pendiente', notaPublicada: false, nota: null }]))
    expect(getPublishedGrade(selectAttemptsByExam(store.getState()).get('parcial-1'))).toBeNull()
    store.dispatch(studentAttemptsReceived([published]))
    expect(getPublishedGrade(selectAttemptsByExam(store.getState()).get('parcial-1'))).toBe(0)
  })
})
