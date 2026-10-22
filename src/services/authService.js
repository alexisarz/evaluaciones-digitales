import { doc, getDoc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'

export const SESSION_KEY = 'evaluacion-digital:legajo'
const HASH_ITERATIONS = 120_000
const encoder = new TextEncoder()

const normalizeLegajo = (value) => {
  const legajo = String(value ?? '').trim()
  if (!/^\d+$/.test(legajo)) throw new Error('Ingresá un legajo válido.')
  return legajo
}

const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
const hexToBytes = (hex) => {
  if (typeof hex !== 'string' || !/^(?:[\da-f]{2})+$/i.test(hex)) throw new Error('Formato de clave inválido.')
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => Number.parseInt(byte, 16))
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: HASH_ITERATIONS, hash: 'SHA-256' }, key, 256)
  return { passwordHash: bytesToHex(new Uint8Array(bits)), passwordSalt: bytesToHex(salt) }
}

const assertActive = (user) => {
  if (user.activo !== true) {
    const error = new Error('Tu usuario se encuentra dado de baja, contactá con el administrador a admin_evaluaciondigital@uade.com.ar')
    error.code = 'account/inactive'
    throw error
  }
}

const publicProfile = (legajo, user) => {
  const { passwordHash, passwordSalt, ...profile } = user
  void passwordHash; void passwordSalt
  return { ...profile, legajo: profile.legajo ?? Number(legajo) }
}

const getUser = async (legajo) => {
  const snapshot = await getDoc(doc(db, 'users', legajo))
  if (!snapshot.exists()) throw new Error('No existe un usuario habilitado con ese legajo.')
  return snapshot.data()
}

export function getSessionLegajo() {
  const value = localStorage.getItem(SESSION_KEY)
  return value && /^\d+$/.test(value) ? value : null
}

const saveSession = (legajo) => localStorage.setItem(SESSION_KEY, legajo)

export async function registerFirstAccess(legajoInput, password) {
  const legajo = normalizeLegajo(legajoInput)
  if (typeof password !== 'string' || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')
  const credentials = await hashPassword(password)
  const ref = doc(db, 'users', legajo)
  const user = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('No existe un usuario habilitado con ese legajo.')
    const current = snapshot.data()
    assertActive(current)
    if (current.contrasenaActiva) throw new Error('Tu contraseña ya fue activada. Iniciá sesión o pedí un blanqueo.')
    transaction.update(ref, { ...credentials, contrasenaActiva: true })
    return current
  })
  saveSession(legajo)
  return publicProfile(legajo, { ...user, contrasenaActiva: true })
}

export async function login(legajoInput, password) {
  const legajo = normalizeLegajo(legajoInput)
  const user = await getUser(legajo)
  assertActive(user)
  if (user.contrasenaActiva !== true || !user.passwordHash || !user.passwordSalt) {
    const error = new Error('Debés definir una nueva contraseña desde «Es mi primer ingreso». Si ya tenías una clave, solicitá un blanqueo al administrador.')
    error.code = 'account/reset-required'
    throw error
  }
  const candidate = await hashPassword(password, user.passwordSalt)
  if (candidate.passwordHash !== user.passwordHash) throw new Error('Credenciales incorrectas.')
  saveSession(legajo)
  return publicProfile(legajo, user)
}

export async function restoreSession(legajoInput) {
  const legajo = normalizeLegajo(legajoInput)
  const user = await getUser(legajo)
  assertActive(user)
  if (user.contrasenaActiva !== true || !user.passwordHash || !user.passwordSalt) throw new Error('La contraseña fue restablecida.')
  return publicProfile(legajo, user)
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
