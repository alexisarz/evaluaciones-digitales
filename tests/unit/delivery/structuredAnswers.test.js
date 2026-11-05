import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  emptyDecisionTable, emptyDecisionTree, hasStructuredContent,
  tableAddColumn, tableAddRow, tableRemoveColumn, tableRemoveRow,
  tableUpdateCell, treeAddBranch, treeRemoveBranch, treeUpdateBranch, treeUpdateNode,
} from '../../../src/features/examQuestions/structuredAnswers'
import { expectedAnswerFor, withoutExpectedAnswers } from '../../../src/features/teacherExams/expectedAnswers'
import DecisionTable from '../../../src/shared/components/DecisionTable'
import DecisionTree from '../../../src/shared/components/DecisionTree'

describe('respuestas estructuradas', () => {
  it('agrega y quita filas y columnas conservando las celdas existentes', () => {
    const initial = emptyDecisionTable()
    const filled = tableUpdateCell(tableAddColumn(tableAddRow(initial)), 1, 0, 'Sí')
    expect(filled.rows).toHaveLength(2)
    expect(filled.columns).toHaveLength(2)
    expect(filled.rows[0].values).toEqual(['Sí', ''])
    expect(tableRemoveColumn(tableRemoveRow(filled)).rows[0].values).toEqual(['Sí'])
    expect(initial.rows[0].values).toEqual([''])
    expect(hasStructuredContent(filled)).toBe(true)
  })

  it('permite ramas anidadas y elimina una rama con su subárbol', () => {
    const initial = emptyDecisionTree()
    const first = treeAddBranch(treeUpdateNode(initial, 1, '¿Cumple la condición?'), 1)
    const labeled = treeUpdateBranch(first, 1, 2, 'Sí')
    const nested = treeAddBranch(labeled, 3)
    expect(nested.root.branches[0].child.branches[0].child.id).toBe(5)
    expect(hasStructuredContent(nested)).toBe(true)
    expect(treeRemoveBranch(nested, 1, 2).root.branches).toEqual([])
    expect(initial.root.branches).toEqual([])
  })

  it('conserva la respuesta esperada estructurada en el examen y la omite para el alumno', () => {
    const expected = tableUpdateCell(emptyDecisionTable(), 1, -1, 'Ingresos > mínimo')
    const topics = [{ nombreTema: 'Tema A', preguntas: [{ idPregunta: 1, tipo: 'Tabla de decisión', respuestaEsperada: expected }] }]
    expect(expectedAnswerFor(topics, 'Tema A', 1)).toEqual(expected)
    expect(withoutExpectedAnswers(topics)[0].preguntas[0]).not.toHaveProperty('respuestaEsperada')
  })

  it('muestra las respuestas guardadas en la corrección sin controles de edición', () => {
    const table = tableUpdateCell(emptyDecisionTable(), 1, -1, 'Ingresos > mínimo')
    const tree = treeUpdateNode(emptyDecisionTree(), 1, '¿Aprobó?')
    const tableHtml = renderToStaticMarkup(createElement(DecisionTable, { value: table, readOnly: true }))
    const treeHtml = renderToStaticMarkup(createElement(DecisionTree, { value: tree, readOnly: true }))
    expect(tableHtml).toContain('Ingresos &gt; mínimo')
    expect(treeHtml).toContain('¿Aprobó?')
    expect(tableHtml).not.toContain('<input')
    expect(treeHtml).not.toContain('<button')
  })
})
