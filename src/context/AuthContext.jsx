import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configured] = useState(isConfigured)

  const loadProfile = useCallback(async (id) => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!error) setProfile(data || null)
  }, [])

  useEffect(() => {
    if (!configured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user || null
      setUser(u)
      if (u) loadProfile(u.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null
      setUser(u)
      if (u) loadProfile(u.id)
      else setProfile(null)
    })

    return () => sub?.subscription.unsubscribe()
  }, [configured, loadProfile])

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = {
    user,
    profile,
    loading,
    configured,
    logout,
    refreshProfile: () => profile && loadProfile(profile.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}