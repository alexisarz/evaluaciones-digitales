import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actualizarCursoAdmin, actualizarUsuarioAdmin, cambiarEstadoUsuarioAdmin, crearCursoAdmin, crearUsuarioAdmin, eliminarCursoAdmin, importarRegistrosAdmin, obtenerUsuarioAdmin, reconciliarCursosEliminadosAdmin, restablecerContrasenaAdmin } from '../../src/services/adminService'
import { student } from '../fixtures/criticalRecords'

const { records } = vi.hoisted(() => ({ records: new Map() }))

vi.mock('../../src/firebase', () => ({ db: {} }))
vi.mock('../../src/services/authService', () => ({ getSessionLegajo: () => '900' }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  const { makeFirestoreMemory } = await import('../mocks/firestoreMemory')
  return { ...actual, ...makeFirestoreMemory(records) }
})

beforeEach(() => {
  records.clear()
  records.set('users/900', { legajo: 900, rol: 'admin', activo: true })
  records.set('users/200045', { legajo: 200045, rol: 'profesor', activo: true, cursosActivos: [] })
  records.set('cursos/CURSO-A', { idCurso: 'CURSO-A', materia: 'Testing', legajoProfe: 200045, comisiones: ['A'] })
})

const audits = () => [...records.entries()]
  .filter(([path]) => path.startsWith('auditoria/'))
  .map(([, value]) => value)

describe('administración de usuarios y cursos', () => {
  it('da de alta alumnos precargados y rechaza duplicados, legajos inválidos y cursos inexistentes', async () => {
    const created = await crearUsuarioAdmin({ legajo: '101', nombre: 'Ana', apellido: 'López', rol: 'alumno', cursosActivos: ['CURSO-A', 'CURSO-A'] })
    expect(created).toMatchObject({ legajo: 101, activo: true, contrasenaActiva: false, cursosActivos: ['CURSO-A'], notas: [] })
    expect(records.get('users/101').rol).toBe('alumno')
    await expect(crearUsuarioAdmin({ legajo: '101', nombre: 'Otra', apellido: 'Persona', rol: 'alumno' })).rejects.toThrow('ya existe')
    await expect(crearUsuarioAdmin({ legajo: '10A', nombre: 'Otra', apellido: 'Persona', rol: 'alumno' })).rejects.toThrow('entero positivo')
    await expect(crearUsuarioAdmin({ legajo: '102', nombre: 'Otra', apellido: 'Persona', rol: 'alumno', cursosActivos: ['INEXISTENTE'] })).rejects.toThrow('no existe')
    expect(records.has('users/102')).toBe(false)
  })

  it('crea un curso con profesor activo y no permite asignarlo a alguien inactivo', async () => {
    const course = await crearCursoAdmin({ idCurso: '2C-MATE-LUN-NOC', materia: 'Matemática', legajoProfe: 200045, comisiones: ['A', 'B'] })
    expect(course.legajoProfe).toBe(200045)
    expect(records.get('users/200045').cursosActivos).toContain('2C-MATE-LUN-NOC')
    await expect(crearCursoAdmin({ idCurso: '2C-MATE-LUN-NOC', materia: 'Otra', legajoProfe: 200045, comisiones: ['A'] })).rejects.toThrow('ya existe')
    records.set('users/200045', { ...records.get('users/200045'), activo: false })
    await expect(crearCursoAdmin({ idCurso: 'OTRO', materia: 'Otra', legajoProfe: 200045, comisiones: ['A'] })).rejects.toThrow('profesor activo')
  })

  it('suspende al alumno sin borrar sus datos, registra la baja y permite reactivarlo', async () => {
    records.set('users/101', student())
    await cambiarEstadoUsuarioAdmin(101, false)
    expect(records.get('users/101')).toMatchObject({ activo: false, cursosActivos: ['CURSO-A'] })
    expect(audits()[0]).toMatchObject({ accion: 'dar_de_baja', objetivo: '101', legajoAdmin: 900 })
    await cambiarEstadoUsuarioAdmin(101, true)
    expect(records.get('users/101').activo).toBe(true)
    expect(audits()[1].accion).toBe('dar_de_alta')
  })

  it('impide dar de baja o mover de curso a un alumno con examen en curso', async () => {
    records.set('users/101', student())
    records.set('examenesEntregados/exam-1_101', { legajoAlumno: 101, estadoEntrega: 'en_curso' })
    await expect(cambiarEstadoUsuarioAdmin(101, false)).rejects.toThrow('examen en curso')
    await expect(actualizarUsuarioAdmin({ legajo: 101, rol: 'alumno', nombre: 'Ana', apellido: 'López', cursosActivos: [] })).rejects.toThrow('examen en curso')
    expect(records.get('users/101').activo).toBe(true)
    expect(records.get('users/101').cursosActivos).toEqual(['CURSO-A'])
  })

  it('blanquea la clave sin eliminar el legajo ni sus cursos y oculta credenciales en la consulta', async () => {
    records.set('users/101', student({ contrasenaActiva: true, passwordHash: 'hash', passwordSalt: 'salt' }))
    const before = await obtenerUsuarioAdmin(101)
    expect(before.claveFirestoreConfigurada).toBe(true)
    expect(before).not.toHaveProperty('passwordHash')
    await restablecerContrasenaAdmin(101)
    expect(records.get('users/101')).toMatchObject({ legajo: 101, cursosActivos: ['CURSO-A'], contrasenaActiva: false })
    expect(records.get('users/101')).not.toHaveProperty('passwordHash')
    expect(records.get('users/101')).not.toHaveProperty('passwordSalt')
    expect(audits()[0].accion).toBe('blanquear_contrasena')
  })

  it('informa por fila cuáles altas CSV fallaron y mantiene las válidas', async () => {
    const progress = []
    const result = await importarRegistrosAdmin('alumnos', [
      { legajo: '101', nombre: 'Ana', apellido: 'López', cursosActivos: 'CURSO-A' },
      { legajo: '101', nombre: 'Duplicada', apellido: 'López', cursosActivos: 'CURSO-A' },
      { legajo: '102', nombre: 'Beto', apellido: 'Díaz', cursosActivos: 'FALTA' },
    ], (done, total) => progress.push([done, total]))
    expect(result.created).toBe(1)
    expect(result.failures).toHaveLength(2)
    expect(result.failures[0]).toMatch(/Fila 3.*ya existe/)
    expect(result.failures[1]).toMatch(/Fila 4.*no existe/)
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]])
    expect(records.has('users/101')).toBe(true)
    expect(records.has('users/102')).toBe(false)
  })

  it('edita datos y cursos de un alumno activo y registra el cambio', async () => {
    records.set('users/101', student())
    records.set('cursos/CURSO-B', { idCurso: 'CURSO-B', legajoProfe: 200045 })
    await actualizarUsuarioAdmin({ legajo: 101, rol: 'alumno', nombre: 'Ana María', apellido: 'López', cursosActivos: ['CURSO-A', 'CURSO-B'] })
    expect(records.get('users/101')).toMatchObject({ nombre: 'Ana María', cursosActivos: ['CURSO-A', 'CURSO-B'] })
    expect(audits()[0].accion).toBe('editar_usuario')
    records.set('users/101', student({ activo: false }))
    await expect(actualizarUsuarioAdmin({ legajo: 101, rol: 'alumno', nombre: 'Ana', apellido: 'López', cursosActivos: ['CURSO-A', 'CURSO-B'] }))
      .rejects.toThrow('dado de baja')
  })

  it('protege las comisiones utilizadas y reasigna un curso cuando está permitido', async () => {
    records.set('users/200046', { legajo: 200046, rol: 'profesor', activo: true, cursosActivos: [] })
    records.set('examenes/exam-1', { cursoCodigo: 'CURSO-A', comisionId: 'A' })
    await expect(actualizarCursoAdmin({ idCurso: 'CURSO-A', materia: 'Testing 2', legajoProfe: 200046, comisiones: ['A'] }))
      .rejects.toThrow('exámenes creados')
    await expect(actualizarCursoAdmin({ idCurso: 'CURSO-A', materia: 'Testing 2', legajoProfe: 200045, comisiones: ['B'] }))
      .rejects.toThrow('comisión')
    records.delete('examenes/exam-1')
    await actualizarCursoAdmin({ idCurso: 'CURSO-A', materia: 'Testing 2', legajoProfe: 200046, comisiones: ['A'] })
    expect(records.get('cursos/CURSO-A')).toMatchObject({ materia: 'Testing 2', legajoProfe: 200046 })
    expect(records.get('users/200046').cursosActivos).toContain('CURSO-A')
    expect(audits()[0].accion).toBe('editar_curso')
  })

  it('limpia referencias a cursos eliminados y rechaza borrar cursos con alumnos o exámenes', async () => {
    records.set('users/101', student({ cursosActivos: ['CURSO-A', 'CURSO-BORRADO'] }))
    await expect(eliminarCursoAdmin('CURSO-A')).rejects.toThrow('usuarios inscriptos')
    const cleaned = await reconciliarCursosEliminadosAdmin([101, 101])
    expect(cleaned).toMatchObject({ usersUpdated: 1, codesRemoved: 1, failures: [] })
    expect(records.get('users/101').cursosActivos).toEqual(['CURSO-A'])
    expect(audits()[0].accion).toBe('limpiar_cursos_eliminados')
  })
})
