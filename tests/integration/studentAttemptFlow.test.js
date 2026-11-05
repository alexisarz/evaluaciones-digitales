import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attemptToDraft, comenzarORecuperarExamen, entregarExamen, guardarProgresoRemoto } from '../../src/services/examAttemptService'
import { exam, student } from '../fixtures/criticalRecords'

const { records } = vi.hoisted(() => ({ records: new Map() }))

vi.mock('../../src/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  const { makeFirestoreMemory } = await import('../mocks/firestoreMemory')
  return { ...actual, ...makeFirestoreMemory(records) }
})

const examId = 'exam-1'
const legajo = 101
const profile = student()
const topic = { nombreTema: 'Tema A', color: '#244a87', preguntas: [
  { idPregunta: 1, consigna: 'Explicá el caso', tipo: 'Texto', puntaje: 10, respuestaEsperada: 'Secreto docente' },
] }

beforeEach(() => {
  records.clear()
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-11-02T19:05:00Z'))
  records.set('users/101', profile)
  records.set(`examenes/${examId}`, exam({ estado: 'programado', fechaInicio: '2026-11-02T19:00:00Z', temas: [topic] }))
})

afterEach(() => vi.useRealTimers())

describe('CLOCK IN, autoguardado y entrega', () => {
  it('crea un único intento, excluye la respuesta esperada y recupera el tema original', async () => {
    const first = await comenzarORecuperarExamen({ id: examId }, topic, profile)
    expect(first).toMatchObject({ examenId: examId, legajoAlumno: legajo, estadoEntrega: 'en_curso' })
    expect(first.preguntas[0].consigna).toBe('Explicá el caso')
    expect(first.preguntas[0]).not.toHaveProperty('respuestaEsperada')

    const second = await comenzarORecuperarExamen({ id: examId }, { nombreTema: 'Tema B' }, profile)
    expect(second.tema.nombreTema).toBe('Tema A')
    expect([...records.keys()].filter((key) => key.startsWith('examenesEntregados/'))).toHaveLength(1)
  })

  it('guarda respuestas e incidentes y entrega una sola vez con la nota pendiente', async () => {
    const attempt = await comenzarORecuperarExamen({ id: examId }, topic, profile)
    const draft = {
      ...attemptToDraft(attempt),
      respuestas: [{ idPregunta: 1, tipo: 'Texto', respuestaTexto: 'Mi respuesta' }],
      incidentes: ['Alumno salió de pestaña'],
      ultimaEdicionMs: Date.now(),
    }
    await guardarProgresoRemoto(examId, legajo, draft.respuestas, draft.incidentes, draft.ultimaEdicionMs)
    const saved = records.get('examenesEntregados/exam-1_101')
    expect(saved.respuestas[0].respuestaTexto).toBe('Mi respuesta')
    expect(saved.incidentes).toEqual(['Alumno salió de pestaña'])

    const submitted = await entregarExamen(attempt, draft)
    expect(submitted).toMatchObject({ estadoEntrega: 'entregado', estadoCorreccion: 'pendiente', notaPublicada: false, motivoEntrega: 'manual' })
    expect(submitted.respuestas[0].respuestaTexto).toBe('Mi respuesta')
    expect(submitted.incidentes).toEqual(['Alumno salió de pestaña'])

    const duplicate = await entregarExamen(attempt, { ...draft, respuestas: [] })
    expect(duplicate.respuestas[0].respuestaTexto).toBe('Mi respuesta')
    expect(records.get('examenesEntregados/exam-1_101').estadoEntrega).toBe('entregado')
  })

  it('rechaza el inicio fuera de horario o cuando el alumno no está activo', async () => {
    vi.setSystemTime(Date.parse('2026-11-02T18:55:00Z'))
    await expect(comenzarORecuperarExamen({ id: examId }, topic, profile)).rejects.toThrow('comenzará')
    vi.setSystemTime(Date.parse('2026-11-02T19:05:00Z'))
    records.set('users/101', student({ activo: false }))
    await expect(comenzarORecuperarExamen({ id: examId }, topic, profile)).rejects.toThrow('No tenés acceso')
    expect(records.has('examenesEntregados/exam-1_101')).toBe(false)
  })
})
