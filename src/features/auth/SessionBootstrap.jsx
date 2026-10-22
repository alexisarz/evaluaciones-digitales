import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { getSessionLegajo, logout, SESSION_KEY } from '../../services/authService'
import { restoreSession, selectUser, sessionCleared } from './authSlice'

export default function SessionBootstrap({ children }) {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)

  useEffect(() => {
    const legajo = getSessionLegajo()
    if (legajo) void dispatch(restoreSession(legajo))
    else dispatch(sessionCleared())
    const onStorage = (event) => {
      if (event.key !== SESSION_KEY) return
      if (event.newValue && /^\d+$/.test(event.newValue)) void dispatch(restoreSession(event.newValue))
      else dispatch(sessionCleared())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [dispatch])

  useEffect(() => {
    if (!user?.legajo) return undefined
    return onSnapshot(doc(db, 'users', String(user.legajo)), (snapshot) => {
      const profile = snapshot.data()
      if (!snapshot.exists() || profile.activo !== true || profile.contrasenaActiva !== true || !profile.passwordHash) {
        logout()
        dispatch(sessionCleared())
      }
    }, () => {})
  }, [dispatch, user?.legajo])

  return children
}
