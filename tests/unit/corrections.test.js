import { describe, expect, it } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import reducer, { finishCorrection, loadCorrectionDelivery, loadCorrectionExam, saveCorrectionDraft, selectCorrectionExpectedAnswers, selectFilteredCorrectionDeliveries } from '../../src/features/corrections/correctionsSlice'
import { correctionTone, correctionTotal, isValidScoreInput, normalizeCorrection } from '../../src/features/corrections/correctionRules'
import { selectFinalizedTeacherExams } from '../../src/features/teacherExams/teacherExamsSlice'
import { getPublishedGrade } from '../../src/features/studentExams/studentGrades'
import { sessionCleared } from '../../src/features/auth/authSlice'

const questions = [{ idPregunta: 1, puntajeMaximo: 2 }, { idPregunta: 2, puntajeMaximo: 8 }]

describe('validación de correcciones', () => {
  it('admite 0 puntos y un borrador incompleto, pero exige todos los puntajes al finalizar', () => {
    const partial = normalizeCorrection(questions, [{ idPregunta: 1, puntaje: 0, comentario: 'Sin desarrollo' }])
    expect(partial).toEqual([{ idPregunta: 1, puntaje: 0, comentario: 'Sin desarrollo' }, { idPregunta: 2, puntaje: null, comentario: '' }])
    expect(() => normalizeCorrection(questions, partial, true)).toThrow('Todas las preguntas deben tener puntaje')
    const finished = normalizeCorrection(questions, [{ idPregunta: 1, puntaje: 0 }, { idPregunta: 2, puntaje: 8 }], true)
    expect(correctionTotal(finished)).toBe(8)
  })

  it('rechaza puntajes menores que cero o mayores al máximo de cada pregunta', () => {
    expect(() => normalizeCorrection(questions, [{ idPregunta: 1, puntaje: -1 }])).toThrow('entre 0 y 2')
    expect(() => normalizeCorrection(questions, [{ idPregunta: 1, puntaje: 2.1 }])).toThrow('entre 0 y 2')
    expect(() => normalizeCorrection(questions, [{ idPregunta: 99, puntaje: 1 }])).toThrow('no pertenecen')
  })

  it('admite un decimal con punto y rechaza dos decimales o coma al ingresar o guardar', () => {
    expect(isValidScoreInput('1.5', 2)).toBe(true)
    expect(isValidScoreInput('1.', 2)).toBe(true)
    expect(isValidScoreInput('1,5', 2)).toBe(false)
    expect(isValidScoreInput('1.25', 2)).toBe(false)
    expect(isValidScoreInput('2.5', 2)).toBe(false)
    const corrected = normalizeCorrection(questions, [
      { idPregunta: 1, puntaje: '1.5' },
      { idPregunta: 2, puntaje: '7.2' },
    ], true)
    expect(corrected.map((item) => item.puntaje)).toEqual([1.5, 7.2])
    expect(correctionTotal(corrected)).toBe(8.7)
    expect(correctionTotal([{ puntaje: 0.1 }, { puntaje: 0.2 }])).toBe(0.3)
    expect(() => normalizeCorrection(questions, [{ idPregunta: 1, puntaje: '1,5' }])).toThrow('entre 0 y 2')
    expect(() => normalizeCorrection(questions, [{ idPregunta: 1, puntaje: '1.25' }])).toThrow('hasta un decimal')
    expect(() => normalizeCorrection(questions, [{ idPregunta: 1, puntaje: 1.25 }])).toThrow('hasta un decimal')
  })

  it('clasifica la nota con los umbrales indicados', () => {
    expect([0, 3.9, 4, 7.9, 8, 10].map(correctionTone)).toEqual(['low', 'low', 'middle', 'middle', 'high', 'high'])
  })
})

describe('estado de entregas para corrección', () => {
  const store = configureStore({ reducer: { corrections: reducer } })
  store.dispatch(loadCorrectionExam.pending('load-1', { examId: 'exam-1' }))
  store.dispatch(loadCorrectionExam.fulfilled({ exam: { id: 'exam-1' }, deliveries: [
    { id: 'a', nombreAlumno: 'José', apellidoAlumno: 'Pérez', legajoAlumno: 123, tema: { nombreTema: 'Tema A' }, estadoCorreccion: 'pendiente' },
    { id: 'b', nombreAlumno: 'Ana', apellidoAlumno: 'Gómez', legajoAlumno: 456, tema: { nombreTema: 'Tema B' }, estadoCorreccion: 'corregido' },
  ] }, 'load-1', { examId: 'exam-1' }))

  it('filtra por nombre, legajo, tema y estado sin distinguir acentos', () => {
    expect(selectFilteredCorrectionDeliveries(store.getState(), 'jose', 'nombre', 'todos').map((item) => item.id)).toEqual(['a'])
    expect(selectFilteredCorrectionDeliveries(store.getState(), '456', 'legajo', 'todos').map((item) => item.id)).toEqual(['b'])
    expect(selectFilteredCorrectionDeliveries(store.getState(), 'Tema A', 'tema', 'todos').map((item) => item.id)).toEqual(['a'])
    expect(selectFilteredCorrectionDeliveries(store.getState(), '', 'todos', 'pendiente').map((item) => item.id)).toEqual(['a'])
  })

  it('conserva un borrador y luego refleja el estado corregido', () => {
    store.dispatch(saveCorrectionDraft.fulfilled({ id: 'a', examenId: 'exam-1', estadoCorreccion: 'pendiente', correccionIniciada: true }, 'save-1', {}))
    expect(store.getState().corrections.deliveries.find((item) => item.id === 'a').correccionIniciada).toBe(true)
    store.dispatch(finishCorrection.fulfilled({ id: 'a', examenId: 'exam-1', estadoCorreccion: 'corregido', nota: 8 }, 'finish-1', {}))
    expect(selectFilteredCorrectionDeliveries(store.getState(), '', 'todos', 'corregido')).toHaveLength(2)
  })
})

describe('respuesta esperada durante la corrección', () => {
  it('conserva la referencia privada al guardar avances y la elimina al cerrar sesión', () => {
    const store = configureStore({ reducer: { corrections: reducer } })
    const expectedAnswers = [{ nombreTema: 'Tema A', preguntas: [{ idPregunta: 1, respuestaEsperada: 'Respuesta modelo' }] }]
    store.dispatch(loadCorrectionDelivery.pending('load-expected', { deliveryId: 'entrega-1' }))
    store.dispatch(loadCorrectionDelivery.fulfilled({ exam: { id: 'exam-1' }, delivery: { id: 'entrega-1' }, expectedAnswers }, 'load-expected', { deliveryId: 'entrega-1' }))
    store.dispatch(saveCorrectionDraft.fulfilled({ id: 'entrega-1', examenId: 'exam-1', estadoCorreccion: 'pendiente' }, 'save-expected', {}))
    expect(selectCorrectionExpectedAnswers(store.getState())).toEqual(expectedAnswers)
    store.dispatch(sessionCleared())
    expect(selectCorrectionExpectedAnswers(store.getState())).toEqual([])
  })
})

describe('exámenes disponibles para corregir', () => {
  it('muestra finalizados activos y excluye archivados, cursos ajenos y exámenes en curso', () => {
    const state = { teacherExams: {
      exams: [
        { id: 'uno', cursoCodigo: 'CURSO-A', estado: 'finalizado' },
        { id: 'dos', cursoCodigo: 'CURSO-A', estado: 'finalizado', archivado: true },
        { id: 'tres', cursoCodigo: 'CURSO-B', estado: 'finalizado' },
        { id: 'cuatro', cursoCodigo: 'CURSO-A', estado: 'en_curso' },
      ],
      courses: [{ idCurso: 'CURSO-A' }],
    } }
    expect(selectFinalizedTeacherExams(state, '', Date.now()).map((exam) => exam.id)).toEqual(['uno'])
    expect(selectFinalizedTeacherExams(state, 'CURSO-B', Date.now())).toEqual([])
  })
})

describe('publicación de notas al alumno', () => {
  it('muestra la nota final publicada, incluso si es 0', () => {
    expect(getPublishedGrade({ estadoEntrega: 'entregado', estadoCorreccion: 'corregido', notaPublicada: true, nota: 0 })).toBe(0)
    expect(getPublishedGrade({ estadoEntrega: 'entregado', estadoCorreccion: 'corregido', notaPublicada: true, nota: 8 })).toBe(8)
  })

  it('oculta borradores, entregas sin corregir y notas expresamente no publicadas', () => {
    expect(getPublishedGrade({ estadoEntrega: 'entregado', estadoCorreccion: 'pendiente', nota: 8 })).toBeNull()
    expect(getPublishedGrade({ estadoEntrega: 'en_curso', estadoCorreccion: 'corregido', nota: 8 })).toBeNull()
    expect(getPublishedGrade({ estadoEntrega: 'entregado', estadoCorreccion: 'corregido', notaPublicada: false, nota: 8 })).toBeNull()
    expect(getPublishedGrade({ estadoEntrega: 'entregado', estadoCorreccion: 'corregido', notaPublicada: true, nota: null })).toBeNull()
  })

  it('también muestra correcciones finalizadas antes de agregar el indicador de publicación', () => {
    expect(getPublishedGrade({ estadoEntrega: 'entregado', estadoCorreccion: 'corregido', nota: 7 })).toBe(7)
  })
})
