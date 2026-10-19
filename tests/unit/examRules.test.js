import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import previewReducer, { previewCleared, previewOpened, selectExamPreviewDraft } from '../../src/features/teacherExams/examPreviewSlice'
import { assertExamCanPublish, hasTenPointsPerTopic, isExamArchivable, isExamDeletable, isValidQuestionScore } from '../../src/features/teacherExams/examRules'
import { selectVisibleTeacherExams } from '../../src/features/teacherExams/teacherExamsSlice'

const futureExam = {
  estado: 'programado',
  fechaInicio: '2026-10-20T19:00:00Z',
  duracionMinutos: 120,
  temas: [{ nombreTema: 'Tema A', preguntas: [{ puntaje: 4 }, { puntaje: 6 }] }],
}
const now = Date.parse('2026-10-19T19:00:00Z')

describe('reglas de exámenes', () => {
  it('acepta sólo puntajes enteros entre 1 y 10', () => {
    expect(isValidQuestionScore(1)).toBe(true)
    expect(isValidQuestionScore(10)).toBe(true)
    for (const value of [-1, 0, 11, 1.5, '']) expect(isValidQuestionScore(value)).toBe(false)
  })

  it('exige que cada tema publicado sume exactamente 10 puntos', () => {
    expect(hasTenPointsPerTopic(futureExam.temas)).toBe(true)
    const incomplete = { ...futureExam, temas: [...futureExam.temas, { nombreTema: 'Tema B', preguntas: [{ puntaje: 9 }] }] }
    expect(hasTenPointsPerTopic(incomplete.temas)).toBe(false)
    expect(() => assertExamCanPublish(incomplete, now)).toThrow('La sumatoria de puntaje de las preguntas debe ser igual a 10.')
    expect(() => assertExamCanPublish(futureExam, now)).not.toThrow()
  })

  it('rechaza publicaciones con fecha pasada', () => {
    expect(() => assertExamCanPublish(futureExam, Date.parse('2026-10-21T00:00:00Z'))).toThrow('La fecha y hora deben ser futuras.')
  })

  it('sólo permite archivar finalizados y borrar borradores o programados futuros', () => {
    expect(isExamDeletable(futureExam, now)).toBe(true)
    expect(isExamArchivable(futureExam, now)).toBe(false)
    const ended = { ...futureExam, fechaInicio: '2026-10-18T19:00:00Z' }
    expect(isExamDeletable(ended, now)).toBe(false)
    expect(isExamArchivable(ended, now)).toBe(true)
    expect(isExamArchivable({ ...ended, archivado: true }, now)).toBe(false)
  })

  it('separa los exámenes archivados del listado principal sin borrarlos', () => {
    const state = { teacherExams: { exams: [{ id: 'visible', ...futureExam }, { id: 'archived', ...futureExam, archivado: true }] } }
    expect(selectVisibleTeacherExams(state, '', now, false).map((exam) => exam.id)).toEqual(['visible'])
    expect(selectVisibleTeacherExams(state, '', now, true).map((exam) => exam.id)).toEqual(['archived'])
  })
})

describe('vista previa temporal', () => {
  it('conserva el formulario en Redux hasta volver al editor y se limpia después', () => {
    const store = configureStore({ reducer: { examPreview: previewReducer } })
    store.dispatch(previewOpened({ originPath: '/profesor/nuevoExamen', legajoProfe: 200045, form: { nombre: 'Parcial 1', temas: futureExam.temas }, activeTopic: 0 }))
    expect(selectExamPreviewDraft(store.getState()).form.nombre).toBe('Parcial 1')
    store.dispatch(previewCleared())
    expect(selectExamPreviewDraft(store.getState())).toBeNull()
  })
})
