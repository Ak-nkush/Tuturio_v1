import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, dashboardPath } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await authApi.me()
      setUser(me)
    } catch {
      try {
        const { user: refreshed } = await authApi.refresh()
        setUser(refreshed)
      } catch {
        setUser(null)
      }
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const login = useCallback(async (email, password) => {
    const { user: loggedIn } = await authApi.login(email, password)
    setUser(loggedIn)
    return loggedIn
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { dashboardPath }
