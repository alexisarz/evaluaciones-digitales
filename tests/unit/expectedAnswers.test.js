import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { expectedAnswerFor, mergeExpectedAnswers, withoutExpectedAnswers } from '../../src/features/teacherExams/expectedAnswers'
import { actualizarExamen, borrarExamen, crearExamen, obtenerExamenPorId, obtenerExamenesPorCursos } from '../../src/services/examsService'

const { records } = vi.hoisted(() => ({ records: new Map() }))

vi.mock('../../src/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  const reference = (path) => ({ path, id: path.split('/').at(-1) })
  return {
    ...actual,
    collection: (_db, path) => reference(path),
    doc: (parent, collectionOrId, id) => reference(parent.path
      ? `${parent.path}/${collectionOrId ?? 'exam-new'}` : `${collectionOrId}/${id}`),
    getDoc: async (ref) => ({ id: ref.id, exists: () => records.has(ref.path), data: () => records.get(ref.path) }),
    getDocs: async (ref) => ({ docs: [...records.entries()]
      .filter(([path]) => path.startsWith(`${ref.path}/`))
      .map(([path, data]) => ({ id: path.split('/').at(-1), data: () => data })) }),
    addDoc: async (ref, data) => {
      records.set(`${ref.path}/exam-new`, data)
      return reference(`${ref.path}/exam-new`)
    },
    runTransaction: async (_db, callback) => {
      const writes = []
      const transaction = {
        get: async (ref) => ({ exists: () => records.has(ref.path), data: () => records.get(ref.path) }),
        update: (ref, data) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...data })),
        set: (ref, data) => writes.push(() => records.set(ref.path, data)),
        delete: (ref) => writes.push(() => records.delete(ref.path)),
      }
      const result = await callback(transaction)
      writes.forEach((write) => write())
      return result
    },
  }
})

const temas = [{ nombreTema: 'Tema A', color: '#1d4ed8', preguntas: [
  { idPregunta: 1, consigna: '¿Qué es un test?', tipo: 'Texto', puntaje: 10, respuestaEsperada: 'Verifica un comportamiento esperado.' },
] }]

describe('respuestas esperadas del profesor', () => {
  beforeEach(() => records.clear())

  it('omite la respuesta modelo de los datos derivados para el alumno', () => {
    const publicTemas = withoutExpectedAnswers(temas)
    const answerTemas = [{ nombreTema: 'Tema A', preguntas: [{ idPregunta: 1, respuestaEsperada: 'Verifica un comportamiento esperado.' }] }]
    expect(publicTemas[0].preguntas[0]).not.toHaveProperty('respuestaEsperada')
    expect(expectedAnswerFor(answerTemas, 'Tema A', 1)).toBe('Verifica un comportamiento esperado.')
    expect(mergeExpectedAnswers(publicTemas, answerTemas)).toEqual(temas)
    expect(mergeExpectedAnswers(publicTemas, [])[0].preguntas[0].respuestaEsperada).toBe('')
  })

  it('guarda la respuesta esperada dentro del documento del examen', async () => {
    const fechaInicio = Timestamp.fromMillis(Date.now() + 86_400_000)
    await crearExamen({ nombre: 'Parcial', cursoCodigo: 'CURSO-A', legajoProfe: 200045,
      fechaInicio, duracionMinutos: 120, toleranciaMinutos: 15, estado: 'programado', temas })

    expect(records.get('examenes/exam-new').temas[0].preguntas[0].respuestaEsperada)
      .toBe('Verifica un comportamiento esperado.')
    expect(records.has('respuestasEsperadas/exam-new')).toBe(false)
    const visibleToStudent = await obtenerExamenesPorCursos(['CURSO-A'])
    expect(visibleToStudent[0].temas[0].preguntas[0]).not.toHaveProperty('respuestaEsperada')
    const editable = await obtenerExamenPorId('exam-new', 200045)
    expect(editable.temas[0].preguntas[0].respuestaEsperada).toBe('Verifica un comportamiento esperado.')
    await expect(obtenerExamenPorId('exam-new', 200046)).rejects.toThrow('No tenés permiso')
  })

  it('actualiza la respuesta en el examen y elimina su documento antiguo si existía', async () => {
    const exam = { nombre: 'Parcial', cursoCodigo: 'CURSO-A', legajoProfe: 200045,
      fechaInicio: Timestamp.fromMillis(Date.now() + 86_400_000), duracionMinutos: 120,
      toleranciaMinutos: 15, estado: 'programado', temas }
    await crearExamen(exam)
    records.set('respuestasEsperadas/exam-new', { legajoProfe: 200045, temas: [{ nombreTema: 'Tema A', preguntas: [{ idPregunta: 1, respuestaEsperada: 'Respuesta anterior' }] }] })
    const updated = [{ ...temas[0], preguntas: [{ ...temas[0].preguntas[0], respuestaEsperada: 'Respuesta corregida' }] }]
    await actualizarExamen('exam-new', { ...exam, temas: updated }, 200045)
    expect(records.get('examenes/exam-new').temas[0].preguntas[0].respuestaEsperada).toBe('Respuesta corregida')
    expect(records.has('respuestasEsperadas/exam-new')).toBe(false)
    await borrarExamen('exam-new', 200045)
    expect(records.has('examenes/exam-new')).toBe(false)
  })

  it('migra al examen las respuestas existentes en la colección anterior al abrirlo', async () => {
    const exam = { nombre: 'Parcial', cursoCodigo: 'CURSO-A', legajoProfe: 200045,
      fechaInicio: Timestamp.fromMillis(Date.now() + 86_400_000), estado: 'programado',
      temas: withoutExpectedAnswers(temas) }
    records.set('examenes/exam-new', exam)
    records.set('respuestasEsperadas/exam-new', { legajoProfe: 200045, temas: [
      { nombreTema: 'Tema A', preguntas: [{ idPregunta: 1, respuestaEsperada: 'Respuesta anterior' }] },
    ] })
    const loaded = await obtenerExamenPorId('exam-new', 200045)
    expect(loaded.temas[0].preguntas[0].respuestaEsperada).toBe('Respuesta anterior')
    expect(records.get('examenes/exam-new').temas[0].preguntas[0].respuestaEsperada).toBe('Respuesta anterior')
    expect(records.has('respuestasEsperadas/exam-new')).toBe(false)
  })
})
