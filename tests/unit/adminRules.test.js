import { describe, expect, it } from 'vitest'
import { addedCourseMembership, changedCourseMembership } from '../../src/features/admin/adminRules'

describe('reglas de asignación de cursos', () => {
  it('detecta movimientos de curso durante una rendición', () => {
    expect(changedCourseMembership(['2A-TEST'], ['2B-TEST'])).toBe(true)
    expect(changedCourseMembership(['2A-TEST'], [])).toBe(true)
    expect(changedCourseMembership(['2A-TEST'], ['2A-TEST'])).toBe(false)
  })

  it('impide asignar cursos nuevos a un usuario dado de baja', () => {
    expect(addedCourseMembership(['2A-TEST'], ['2A-TEST', '2B-TEST'])).toBe(true)
    expect(addedCourseMembership(['2A-TEST'], [])).toBe(false)
  })
})
