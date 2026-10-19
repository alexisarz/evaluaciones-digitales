import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase'
import { restoreSession, sessionCleared } from './authSlice'

export default function SessionBootstrap({ children }) {
  const dispatch = useDispatch()
  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) dispatch(restoreSession(firebaseUser))
    else dispatch(sessionCleared())
  }), [dispatch])
  return children
}
