// A non-extractable Web Crypto key keeps answer text encrypted at rest in IndexedDB.
const DATABASE = 'evaluacion-digital-borradores'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: 'id' })
      request.result.createObjectStore('keys')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function encryptionKey(database, id) {
  const existing = await requestResult(database.transaction('keys').objectStore('keys').get(id))
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await requestResult(database.transaction('keys', 'readwrite').objectStore('keys').put(key, id))
  return key
}

export async function guardarBorradorLocal(draft) {
  const database = await openDatabase()
  try {
    const key = await encryptionKey(database, draft.id)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(draft)))
    await requestResult(database.transaction('drafts', 'readwrite').objectStore('drafts').put({
      id: draft.id,
      legajoAlumno: draft.legajoAlumno,
      iv,
      encrypted,
    }))
  } finally { database.close() }
}

async function decryptDraft(database, record) {
  const key = await requestResult(database.transaction('keys').objectStore('keys').get(record.id))
  if (!key) return null
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.encrypted)
  return JSON.parse(decoder.decode(decrypted))
}

export async function obtenerBorradorLocal(id) {
  const database = await openDatabase()
  try {
    const record = await requestResult(database.transaction('drafts').objectStore('drafts').get(id))
    return record ? await decryptDraft(database, record) : null
  } finally { database.close() }
}

export async function listarBorradoresLocales(legajo) {
  const database = await openDatabase()
  try {
    const records = await requestResult(database.transaction('drafts').objectStore('drafts').getAll())
    const matching = records.filter((record) => record.legajoAlumno === Number(legajo))
    return (await Promise.all(matching.map((record) => decryptDraft(database, record)))).filter(Boolean)
  } finally { database.close() }
}

export async function eliminarBorradorLocal(id) {
  const database = await openDatabase()
  try {
    await requestResult(database.transaction('drafts', 'readwrite').objectStore('drafts').delete(id))
  } finally { database.close() }
}
