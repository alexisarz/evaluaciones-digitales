import { beforeEach, describe, expect, it, vi } from 'vitest'
import { finalizarCorreccion, guardarBorradorCorreccion, obtenerEntregaParaCorreccion, obtenerEntregasParaCorreccion } from '../../src/services/correctionsService'
import { delivery, exam } from '../fixtures/criticalRecords'

const { records } = vi.hoisted(() => ({ records: new Map() }))

vi.mock('../../src/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  const { makeFirestoreMemory } = await import('../mocks/firestoreMemory')
  return { ...actual, ...makeFirestoreMemory(records) }
})

beforeEach(() => {
  records.clear()
  records.set('examenes/exam-1', exam())
  records.set('cursos/CURSO-A', { legajoProfe: 200045 })
  records.set('examenesEntregados/exam-1_101', delivery())
})

describe('corrección y publicación de notas', () => {
  it('guarda un avance incompleto sin publicar y publica al finalizar todos los puntajes', async () => {
    await guardarBorradorCorreccion('exam-1_101', 200045, [
      { idPregunta: 1, puntaje: '1.5', comentario: 'Revisar' },
    ])
    const draft = records.get('examenesEntregados/exam-1_101')
    expect(draft).toMatchObject({ estadoCorreccion: 'pendiente', correccionIniciada: true })
    expect(draft.notaPublicada).toBe(false)
    expect(draft.correccion.map((item) => item.puntaje)).toEqual([1.5, null])

    await finalizarCorreccion('exam-1_101', 200045, [
      { idPregunta: 1, puntaje: '1.5', comentario: 'Correcto' },
      { idPregunta: 2, puntaje: '7.2', comentario: 'Falta una condición' },
    ])
    const finished = records.get('examenesEntregados/exam-1_101')
    expect(finished).toMatchObject({ estadoCorreccion: 'corregido', nota: 8.7, notaPublicada: true, legajoCorrector: 200045 })
    expect(finished.correccion[1].comentario).toBe('Falta una condición')
    await expect(finalizarCorreccion('exam-1_101', 200045, [])).rejects.toThrow('ya fue corregida')
  })

  it('rechaza puntajes fuera de rango y no modifica una entrega ante un profesor ajeno', async () => {
    const before = records.get('examenesEntregados/exam-1_101')
    await expect(finalizarCorreccion('exam-1_101', 200045, [
      { idPregunta: 1, puntaje: 3 }, { idPregunta: 2, puntaje: 8 },
    ])).rejects.toThrow('entre 0 y 2')
    await expect(finalizarCorreccion('exam-1_101', 200046, [
      { idPregunta: 1, puntaje: 2 }, { idPregunta: 2, puntaje: 8 },
    ])).rejects.toThrow('No tenés permiso')
    expect(records.get('examenesEntregados/exam-1_101')).toBe(before)
  })

  it('lista solo las entregas de ese examen y profesor', async () => {
    records.set('examenesEntregados/exam-1_102', delivery({ legajoAlumno: 102, estadoEntrega: 'en_curso' }))
    records.set('examenesEntregados/exam-1_103', delivery({ legajoAlumno: 103, legajoProfe: 200046 }))
    records.set('examenesEntregados/exam-2_104', delivery({ examenId: 'exam-2', legajoAlumno: 104 }))
    const result = await obtenerEntregasParaCorreccion('exam-1', 200045)
    expect(result.deliveries.map((item) => item.id)).toEqual(['exam-1_101'])
    await expect(obtenerEntregasParaCorreccion('exam-1', 200046)).rejects.toThrow('No tenés permiso')
  })

  it('abre una entrega propia con la respuesta esperada solo para el profesor', async () => {
    const answer = { nombreTema: 'Tema A', preguntas: [{ idPregunta: 1, respuestaEsperada: 'Modelo docente' }] }
    records.set('examenes/exam-1', exam({ temas: [answer] }))
    const result = await obtenerEntregaParaCorreccion('exam-1_101', 200045)
    expect(result.delivery.preguntas[0]).not.toHaveProperty('respuestaEsperada')
    expect(result.expectedAnswers).toEqual([answer])
    await expect(obtenerEntregaParaCorreccion('exam-1_101', 200046)).rejects.toThrow('No tenés permiso')
  })
})
