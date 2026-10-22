import { describe, expect, it } from 'vitest'
import { hashPassword } from '../../src/services/authService'

describe('credenciales del prototipo Firestore', () => {
  it('deriva la misma clave con la misma sal, sin guardar el texto original', async () => {
    const first = await hashPassword('clave-de-prueba-123')
    const repeated = await hashPassword('clave-de-prueba-123', first.passwordSalt)
    const wrong = await hashPassword('otra-clave-123', first.passwordSalt)

    expect(first.passwordHash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.passwordSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(first.passwordHash).not.toContain('clave-de-prueba-123')
    expect(repeated.passwordHash).toBe(first.passwordHash)
    expect(wrong.passwordHash).not.toBe(first.passwordHash)
  })

  it('rechaza una sal mal formada', async () => {
    await expect(hashPassword('clave-de-prueba-123', 'sal-invalida')).rejects.toThrow('Formato de clave inválido.')
  })
})
