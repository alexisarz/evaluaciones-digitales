import { useDispatch, useSelector } from 'react-redux'
import { login, logout, registerFirstAccess, selectAuthLoading, selectUser } from './authSlice'

export function useAuth() {
  const dispatch = useDispatch()
  return {
    user: useSelector(selectUser),
    loading: useSelector(selectAuthLoading),
    login: (legajo, password) => dispatch(login({ legajo, password })).unwrap(),
    registerFirstAccess: (legajo, password) => dispatch(registerFirstAccess({ legajo, password })).unwrap(),
    logout: () => dispatch(logout()).unwrap(),
  }
}
