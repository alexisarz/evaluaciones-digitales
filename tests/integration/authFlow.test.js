import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSessionLegajo, hashPassword, login, logout, registerFirstAccess, restoreSession, SESSION_KEY } from '../../src/services/authService'
import { student } from '../fixtures/criticalRecords'

const { records } = vi.hoisted(() => ({ records: new Map() }))

vi.mock('../../src/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal()
  const { makeFirestoreMemory } = await import('../mocks/firestoreMemory')
  return { ...actual, ...makeFirestoreMemory(records) }
})

let storage

beforeEach(() => {
  records.clear()
  const values = new Map()
  storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => vi.unstubAllGlobals())

describe('activación y acceso por legajo', () => {
  it('activa una cuenta precargada, conserva su rol y permite entrar y restaurar la sesión', async () => {
    records.set('users/101', student())
    const activated = await registerFirstAccess('101', 'clave-valida-123')
    expect(activated).toMatchObject({ legajo: 101, rol: 'alumno', contrasenaActiva: true })
    expect(activated).not.toHaveProperty('passwordHash')
    expect(records.get('users/101')).toMatchObject({ contrasenaActiva: true, passwordHash: expect.any(String) })
    expect(storage.getItem(SESSION_KEY)).toBe('101')

    logout()
    expect(getSessionLegajo()).toBeNull()
    expect(await login(101, 'clave-valida-123')).toMatchObject({ legajo: 101, rol: 'alumno' })
    expect(await restoreSession('101')).toMatchObject({ nombre: 'Ana', rol: 'alumno' })
  })

  it('rechaza legajos inexistentes o ya activados sin crear otra cuenta', async () => {
    await expect(registerFirstAccess('999', 'clave-valida')).rejects.toThrow('No existe un usuario')
    records.set('users/101', student({ contrasenaActiva: true }))
    await expect(registerFirstAccess('101', 'clave-valida')).rejects.toThrow('ya fue activada')
    expect(records.get('users/101')).not.toHaveProperty('passwordHash')
    expect(getSessionLegajo()).toBeNull()
  })

  it('rechaza clave incorrecta y exige activación tras un blanqueo', async () => {
    const credentials = await hashPassword('clave-valida')
    records.set('users/101', student({ contrasenaActiva: true, ...credentials }))
    await expect(login('101', 'clave-erronea')).rejects.toThrow('Credenciales incorrectas')
    expect(getSessionLegajo()).toBeNull()
    records.set('users/101', student({ contrasenaActiva: false }))
    await expect(login('101', 'clave-valida')).rejects.toMatchObject({ code: 'account/reset-required' })
    await expect(restoreSession('101')).rejects.toThrow('restablecida')
  })

  it('bloquea a alumnos dados de baja incluso si ya habían definido contraseña', async () => {
    records.set('users/101', student({ activo: false, contrasenaActiva: true }))
    await expect(login('101', 'cualquier-clave')).rejects.toMatchObject({ code: 'account/inactive' })
    await expect(registerFirstAccess('101', 'clave-valida')).rejects.toMatchObject({ code: 'account/inactive' })
    await expect(restoreSession('101')).rejects.toMatchObject({ code: 'account/inactive' })
    expect(getSessionLegajo()).toBeNull()
  })
})
