import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import * as authService from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        setUser(await authService.getProfileFromAuthUser(firebaseUser))
      } catch {
        // Una cuenta suspendida o sin perfil no conserva una sesión válida.
        await authService.logout()
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (legajo, password) => {
        const profile = await authService.login(legajo, password)
        setUser(profile)
        return profile
      },
      registerFirstAccess: async (legajo, password) => {
        const profile = await authService.registerFirstAccess(legajo, password)
        setUser(profile)
        return profile
      },
      logout: async () => {
        await authService.logout()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
