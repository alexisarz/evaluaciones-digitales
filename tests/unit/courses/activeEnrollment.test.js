import { describe, expect, it } from 'vitest'
import { activeStudentsFromSnapshot } from '../../../src/shared/activeEnrollment'

describe('inscripciones visibles', () => {
  it('incluye solo alumnos activos aunque conserven cursosActivos al darse de baja', () => {
    const snapshot = { docs: [
      { id: '101', data: () => ({ rol: 'alumno', activo: true, cursosActivos: ['2C-MATE'] }) },
      { id: '102', data: () => ({ rol: 'alumno', activo: false, cursosActivos: ['2C-MATE'] }) },
      { id: '200', data: () => ({ rol: 'profesor', activo: true, cursosActivos: ['2C-MATE'] }) },
    ] }
    expect(activeStudentsFromSnapshot(snapshot).map((student) => student.id)).toEqual(['101'])
  })
})
