import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'

export default function AuthLayout() {
  const { session, role, loading } = useAuth()

  if (!loading && session) {
    return <Redirect href={role === 'entrenador' ? '/(tabs)/entrenador' : '/(tabs)/alumno'} />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
