import { describe, expect, it } from 'vitest'
import { forcedBackupId, hasUnsyncedForcedAnswers } from '../../src/features/studentExams/forcedEndRules'

describe('respuestas locales tras finalización del profesor', () => {
  it('detecta respuestas que no llegaron a la entrega forzada', () => {
    const remote = { motivoEntrega: 'finalizacion_profesor', respuestas: [{ idPregunta: 1, respuestaTexto: 'Guardada' }] }
    expect(hasUnsyncedForcedAnswers({ respuestas: [{ idPregunta: 1, respuestaTexto: 'Más reciente' }] }, remote)).toBe(true)
    expect(hasUnsyncedForcedAnswers({ respuestas: remote.respuestas, ultimaEdicionMs: Date.now() }, remote)).toBe(false)
    expect(hasUnsyncedForcedAnswers({ respuestas: [] }, { ...remote, motivoEntrega: 'manual' })).toBe(false)
  })

  it('usa un identificador distinto para no sobrescribir el intento original', () => {
    expect(forcedBackupId('exam-1_101')).toBe('exam-1_101_forced_backup')
  })
})
