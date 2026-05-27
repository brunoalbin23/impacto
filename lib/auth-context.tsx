import { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthState = {
  session: Session | null
  role: string | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

// Uses the access_token directly to bypass the timing issue where
// supabase.from() inside onAuthStateChange runs before the client
// has the JWT set internally, causing 42501 permission errors.
async function fetchRoleWithToken(
  userId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=rol&id=eq.${userId}&limit=1`
    const res = await Promise.race([
      fetch(url, {
        headers: {
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${accessToken}`,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      ),
    ])
    if (!res.ok) {
      console.error('fetchRole HTTP error:', res.status)
      return null
    }
    const data = await res.json()
    return data[0]?.rol ?? null
  } catch (e) {
    console.error('fetchRole failed:', e)
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    role: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return

        const newRole = newSession
          ? await fetchRoleWithToken(newSession.user.id, newSession.access_token)
          : null

        if (!mounted) return

        setState({ session: newSession, role: newRole, loading: false })
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  )
}
