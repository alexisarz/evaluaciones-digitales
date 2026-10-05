import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const EMAIL_DOMAIN = 'evaluacionuade.edu.ar'

export const pseudoEmailFromLegajo = (legajo) =>
  `${String(legajo).trim()}@${EMAIL_DOMAIN}`

const normalizeLegajo = (legajo) => {
  const value = String(legajo).trim()
  if (!/^\d+$/.test(value)) {
    throw new Error('Ingresá un legajo válido.')
  }
  return value
}

const getUserDocument = async (legajo) => {
  const userRef = doc(db, 'users', legajo)
  const userSnapshot = await getDoc(userRef)

  if (!userSnapshot.exists()) {
    throw new Error('No existe un usuario habilitado con ese legajo.')
  }

  return { ref: userRef, data: userSnapshot.data() }
}

const assertActive = (user) => {
  if (user.activo !== true) {
    throw new Error('Cuenta suspendida. Contactá al administrador.')
  }
}

/**
 * Registra al usuario sólo en su primer acceso, validando previamente la lista
 * de usuarios precargada en Firestore.
 */
export const registerFirstAccess = async (legajoInput, password) => {
  const legajo = normalizeLegajo(legajoInput)
  const { ref, data: user } = await getUserDocument(legajo)

  assertActive(user)
  if (user.contrasenaActiva) {
    throw new Error('Tu contraseña ya fue activada. Iniciá sesión.')
  }

  await createUserWithEmailAndPassword(auth, pseudoEmailFromLegajo(legajo), password)
  await updateDoc(ref, { contrasenaActiva: true })

  return { ...user, legajo: user.legajo ?? Number(legajo), contrasenaActiva: true }
}

/** Autentica con Firebase Auth y revalida el estado y rol desde Firestore. */
export const login = async (legajoInput, password) => {
  const legajo = normalizeLegajo(legajoInput)
  const credential = await signInWithEmailAndPassword(
    auth,
    pseudoEmailFromLegajo(legajo),
    password,
  )

  try {
    const { data: user } = await getUserDocument(legajo)
    assertActive(user)
    return { ...user, legajo: user.legajo ?? Number(legajo), uid: credential.user.uid }
  } catch (error) {
    await signOut(auth)
    throw error
  }
}

/** Recupera el perfil al restaurarse una sesión persistida de Firebase Auth. */
export const getProfileFromAuthUser = async (firebaseUser) => {
  const legajo = firebaseUser.email?.split('@')[0]
  if (!legajo || firebaseUser.email !== pseudoEmailFromLegajo(legajo)) {
    throw new Error('La sesión no corresponde a una cuenta de evaluación válida.')
  }

  const { data: user } = await getUserDocument(legajo)
  assertActive(user)
  return { ...user, legajo: user.legajo ?? Number(legajo), uid: firebaseUser.uid }
}

export const logout = () => signOut(auth)
