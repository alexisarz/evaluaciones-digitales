import { describe, expect, it } from 'vitest'
import { addedCourseMembership, changedCourseMembership, findOrphanCourseAssignments, sanitizeCourseCode } from '../../src/features/admin/adminRules'
import { crearCursoAdmin } from '../../src/services/adminService'

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

  it('identifica sólo referencias a cursos inexistentes y conserva las válidas', () => {
    const users = [
      { legajo: 100932, rol: 'alumno', cursosActivos: ['2A-TEST', '2A-MAT'] },
      { legajo: 200045, rol: 'profesor', cursosActivos: ['2A-MAT'] },
      { legajo: 300001, rol: 'admin', cursosActivos: ['2A-MAT'] },
    ]
    expect(findOrphanCourseAssignments(users, [{ id: '2A-TEST' }])).toEqual([
      { legajo: '100932', missingCodes: ['2A-MAT'] },
      { legajo: '200045', missingCodes: ['2A-MAT'] },
    ])
  })
})

describe('alta de cursos', () => {
  it('conserva únicamente letras, números y guiones al escribir o pegar', () => {
    expect(sanitizeCourseCode('2C-MATÉ_ LUN/@NOC')).toBe('2C-MATÉLUNNOC')
  })

  it('rechaza espacios en el código antes de escribir en Firestore', async () => {
    await expect(crearCursoAdmin({ idCurso: '2C- MATE-LUN-NOC', materia: 'Matemática', legajoProfe: 200045, comisiones: ['Comisión A'] }))
      .rejects.toThrow('El código del curso no puede contener espacios.')
    await expect(crearCursoAdmin({ idCurso: '2C-MATE-LUN-NOC ', materia: 'Matemática', legajoProfe: 200045, comisiones: ['Comisión A'] }))
      .rejects.toThrow('El código del curso no puede contener espacios.')
  })

  it('rechaza símbolos especiales en códigos recibidos por importación', async () => {
    await expect(crearCursoAdmin({ idCurso: '2C-MATE-LUN@NOC', materia: 'Matemática', legajoProfe: 200045, comisiones: ['Comisión A'] }))
      .rejects.toThrow('El código del curso solo puede contener letras, números y guiones (-).')
  })
})
