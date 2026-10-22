const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')

initializeApp()
const db = getFirestore()
const auth = getAuth()
const emailFor = (legajo) => `${legajo}@evaluacionuade.edu.ar`

function parseLegajo(value) {
  const text = String(value ?? '')
  const parsed = Number(text)
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new HttpsError('invalid-argument', 'Ingresá un legajo válido.')
  }
  return parsed
}

async function requireAdmin(request) {
  const email = request.auth?.token?.email
  if (!email || !email.endsWith('@evaluacionuade.edu.ar')) {
    throw new HttpsError('unauthenticated', 'Iniciá sesión como administrador.')
  }
  const legajo = parseLegajo(email.split('@')[0])
  if (email !== emailFor(legajo)) {
    throw new HttpsError('permission-denied', 'La identidad del administrador no es válida.')
  }
  const snapshot = await db.collection('users').doc(String(legajo)).get()
  if (!snapshot.exists || snapshot.data().rol !== 'admin' || snapshot.data().activo !== true) {
    throw new HttpsError('permission-denied', 'Esta operación requiere un administrador activo.')
  }
  return legajo
}

async function findAuthUser(legajo) {
  try { return await auth.getUserByEmail(emailFor(legajo)) }
  catch (error) {
    if (error.code === 'auth/user-not-found') return null
    throw error
  }
}

function auditBatch(batch, action, adminId, targetId) {
  batch.set(db.collection('auditoria').doc(), {
    accion: action,
    legajoAdmin: adminId,
    objetivo: String(targetId),
    fecha: FieldValue.serverTimestamp(),
  })
}

exports.restablecerContrasenaAdmin = onCall({ region: 'us-central1' }, async (request) => {
  const adminId = await requireAdmin(request)
  const legajo = parseLegajo(request.data?.legajo)
  if (legajo === adminId) throw new HttpsError('failed-precondition', 'No podés blanquear tu propia contraseña desde esta sesión.')
  const ref = db.collection('users').doc(String(legajo))
  const target = await ref.get()
  if (!target.exists) throw new HttpsError('not-found', 'El usuario no existe.')
  if (!['alumno', 'profesor'].includes(target.data().rol)) throw new HttpsError('permission-denied', 'Sólo se pueden restablecer cuentas de alumnos y profesores desde este panel.')

  // La cuenta Auth existente debe desaparecer: cambiar sólo Firestore impediría
  // el nuevo createUserWithEmailAndPassword porque el pseudo-email seguiría ocupado.
  const existingAuthUser = await findAuthUser(legajo)
  if (existingAuthUser) await auth.deleteUser(existingAuthUser.uid)
  const batch = db.batch()
  batch.update(ref, { contrasenaActiva: false })
  auditBatch(batch, 'blanquear_contrasena', adminId, legajo)
  await batch.commit()
  return { ok: true }
})

exports.cambiarEstadoUsuarioAdmin = onCall({ region: 'us-central1' }, async (request) => {
  const adminId = await requireAdmin(request)
  const legajo = parseLegajo(request.data?.legajo)
  const activo = request.data?.activo
  if (typeof activo !== 'boolean') throw new HttpsError('invalid-argument', 'Indicá el estado deseado.')
  if (legajo === adminId) throw new HttpsError('failed-precondition', 'No podés modificar tu propio estado.')
  const ref = db.collection('users').doc(String(legajo))
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new HttpsError('not-found', 'El usuario no existe.')
  const profile = snapshot.data()
  if (!['alumno', 'profesor'].includes(profile.rol)) throw new HttpsError('permission-denied', 'Sólo se pueden dar de baja alumnos y profesores desde este panel.')
  if (!activo && profile.rol === 'alumno') {
    const attempts = await db.collection('examenesEntregados').where('legajoAlumno', '==', legajo).get()
    if (attempts.docs.some((item) => item.data().estadoEntrega === 'en_curso')) {
      throw new HttpsError('failed-precondition', 'No se puede dar de baja a un alumno con un examen en curso.')
    }
  }
  if (!activo && profile.rol === 'profesor') {
    const assigned = await db.collection('cursos').where('legajoProfe', '==', legajo).limit(1).get()
    if (!assigned.empty) throw new HttpsError('failed-precondition', 'Reasigná los cursos del profesor antes de darlo de baja.')
  }

  const existingAuthUser = await findAuthUser(legajo)
  if (activo && existingAuthUser) await auth.updateUser(existingAuthUser.uid, { disabled: false })
  const batch = db.batch()
  batch.update(ref, { activo })
  auditBatch(batch, activo ? 'dar_de_alta' : 'dar_de_baja', adminId, legajo)
  await batch.commit()
  if (!activo && existingAuthUser) {
    await auth.updateUser(existingAuthUser.uid, { disabled: true })
    await auth.revokeRefreshTokens(existingAuthUser.uid)
  }
  return { ok: true }
})
