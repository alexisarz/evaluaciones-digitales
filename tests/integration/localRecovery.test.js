import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { eliminarBorradorLocal, guardarBorradorLocal, listarBorradoresLocales, obtenerBorradorLocal } from '../../src/services/localExamDraft'

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => vi.unstubAllGlobals())

describe('respaldo local de una rendición', () => {
  it('recupera las respuestas tras un corte y no las mezcla con otro legajo', async () => {
    const first = { id: 'exam-1_101', legajoAlumno: 101, respuestas: [{ idPregunta: 1, respuestaTexto: 'Mi respuesta antes del corte' }] }
    const second = { id: 'exam-1_102', legajoAlumno: 102, respuestas: [{ idPregunta: 1, respuestaTexto: 'Otra respuesta' }] }
    await guardarBorradorLocal(first)
    await guardarBorradorLocal(second)
    expect(await obtenerBorradorLocal(first.id)).toEqual(first)
    expect(await listarBorradoresLocales(101)).toEqual([first])
    expect(await listarBorradoresLocales(102)).toEqual([second])

    await eliminarBorradorLocal(first.id)
    expect(await obtenerBorradorLocal(first.id)).toBeNull()
    expect(await listarBorradoresLocales(101)).toEqual([])
    expect(await obtenerBorradorLocal(second.id)).toEqual(second)
  })

  it('no deja la respuesta en texto legible dentro del registro local', async () => {
    const draft = { id: 'exam-1_101', legajoAlumno: 101, respuestas: [{ idPregunta: 1, respuestaTexto: 'Dato privado de prueba' }] }
    await guardarBorradorLocal(draft)
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('evaluacion-digital-borradores', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction('drafts').objectStore('drafts').get(draft.id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    expect(record).toHaveProperty('encrypted')
    expect(JSON.stringify(record)).not.toContain('Dato privado de prueba')
  })
})
