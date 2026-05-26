import { Stack, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return

      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', session.user.id)
          .single()
        if (!mounted) return
        setRole(data?.rol ?? null)
      }

      setSession(session)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return

        if (session) {
          const { data } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', session.user.id)
            .single()
          if (!mounted) return
          setRole(data?.rol ?? null)
        } else {
          setRole(null)
        }

        setSession(session)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && role && inAuthGroup) {
      if (role === 'entrenador') {
        router.replace('/(tabs)/entrenador')
      } else {
        router.replace('/(tabs)/alumno')
      }
    }
  }, [session, role, loading])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}
