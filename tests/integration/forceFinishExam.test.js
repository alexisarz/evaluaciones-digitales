import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { finalizarExamenAnticipadamente } from '../../src/services/examParticipantsService'
import { comenzarORecuperarExamen, guardarProgresoRemoto } from '../../src/services/examAttemptService'

const { records } = vi.hoisted(() => ({ records: new Map() }))

vi.mock('../../src/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    collection: (_db, path) => ({ path }),
    doc: (_db, ...parts) => ({ path: parts.join('/') }),
    where: (field, operator, value) => ({ field, operator, value }),
    query: (reference, filter) => ({ ...reference, filter }),
    getDocs: async (reference) => ({ docs: [...records.entries()]
      .filter(([path, data]) => path.startsWith(`${reference.path}/`) &&
        (!reference.filter || data[reference.filter.field] === reference.filter.value))
      .map(([path, data]) => ({ id: path.split('/').at(-1), ref: { path }, data: () => data })) }),
    runTransaction: async (_db, callback) => {
      const updates = []
      const transaction = {
        get: async (reference) => ({ exists: () => records.has(reference.path), data: () => records.get(reference.path) }),
        update: (reference, values) => updates.push([reference.path, values]),
      }
      const result = await callback(transaction)
      for (const [path, values] of updates) records.set(path, { ...records.get(path), ...values })
      return result
    },
    serverTimestamp: () => ({ serverTime: true }),
  }
})

describe('finalización anticipada del examen', () => {
  beforeEach(() => {
    records.clear()
    vi.useRealTimers()
  })

  it('cierra el ingreso y entrega los intentos abiertos conservando sus respuestas', async () => {
    const start = Date.parse('2026-11-02T19:00:00Z')
    const finish = Date.parse('2026-11-02T19:25:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(finish)
    records.set('examenes/exam-1', {
      nombre: 'Parcial 1', estado: 'programado', cursoCodigo: 'CURSO-A', legajoProfe: 200045,
      fechaInicio: Timestamp.fromMillis(start), duracionMinutos: 120, toleranciaMinutos: 15,
    })
    records.set('cursos/CURSO-A', { legajoProfe: 200045 })
    records.set('examenesEntregados/exam-1_101', {
      examenId: 'exam-1', legajoProfe: 200045, legajoAlumno: 101, estadoEntrega: 'en_curso',
      fechaInicioAlumno: Timestamp.fromMillis(start + 60_000), respuestas: [{ idPregunta: 1, respuestaTexto: 'Avance guardado' }],
    })
    records.set('examenesEntregados/exam-1_102', {
      examenId: 'exam-1', legajoProfe: 200045, legajoAlumno: 102, estadoEntrega: 'entregado',
      motivoEntrega: 'manual', respuestas: [{ idPregunta: 1, respuestaTexto: 'Entrega previa' }],
    })

    const result = await finalizarExamenAnticipadamente('exam-1', 200045)
    expect(result.fechaFinForzada.toMillis()).toBe(finish)
    expect(records.get('examenes/exam-1').estado).toBe('finalizado')
    const forced = records.get('examenesEntregados/exam-1_101')
    expect(forced).toMatchObject({ estadoEntrega: 'entregado', motivoEntrega: 'finalizacion_profesor', tiempoUtilizadoSegundos: 24 * 60 })
    expect(forced.fechaEntrega.toMillis()).toBe(finish)
    expect(forced.respuestas).toEqual([{ idPregunta: 1, respuestaTexto: 'Avance guardado' }])
    expect(records.get('examenesEntregados/exam-1_102').motivoEntrega).toBe('manual')
    expect((await finalizarExamenAnticipadamente('exam-1', 200045)).fechaFinForzada.toMillis()).toBe(finish)
  })

  it('rechaza a otro profesor sin cambiar el examen ni las entregas', async () => {
    records.set('examenes/exam-1', { cursoCodigo: 'CURSO-A', legajoProfe: 200045, estado: 'en_curso' })
    await expect(finalizarExamenAnticipadamente('exam-1', 200046)).rejects.toThrow('No tenés permiso')
    expect(records.get('examenes/exam-1').estado).toBe('en_curso')
  })

  it('bloquea nuevos ingresos y autoguardados después del cierre forzado', async () => {
    const start = Date.parse('2026-11-02T19:00:00Z')
    const finish = Date.parse('2026-11-02T19:25:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(finish + 1000)
    records.set('examenes/exam-1', {
      estado: 'finalizado', cursoCodigo: 'CURSO-A', legajoProfe: 200045,
      fechaInicio: Timestamp.fromMillis(start), fechaFinForzada: Timestamp.fromMillis(finish),
      duracionMinutos: 120, toleranciaMinutos: 30,
    })
    records.set('users/103', { legajo: 103, activo: true, rol: 'alumno', cursosActivos: ['CURSO-A'] })
    await expect(comenzarORecuperarExamen({ id: 'exam-1' }, { nombreTema: 'Tema A' }, { legajo: 103 }))
      .rejects.toThrow('El examen venció')
    records.set('examenesEntregados/exam-1_101', {
      examenId: 'exam-1', legajoAlumno: 101, estadoEntrega: 'en_curso',
      fechaInicioProgramada: Timestamp.fromMillis(start), duracionMinutos: 120,
      respuestas: [{ idPregunta: 1, respuestaTexto: 'Respuesta previa' }],
    })
    await guardarProgresoRemoto('exam-1', 101, [{ idPregunta: 1, respuestaTexto: 'Respuesta tardía' }], [], finish + 1000)
    expect(records.get('examenesEntregados/exam-1_101').respuestas[0].respuestaTexto).toBe('Respuesta previa')
  })
})
