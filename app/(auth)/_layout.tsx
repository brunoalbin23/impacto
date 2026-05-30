import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'

function getTabHref(role: string | null, estado: string | null) {
  if (role === 'entrenador') return '/(tabs)/entrenador'
  if (estado === 'pendiente') return '/(tabs)/alumno/pendiente'
  if (estado === 'rechazado') return '/(tabs)/alumno/rechazado'
  return '/(tabs)/alumno'
}

export default function AuthLayout() {
  const { session, role, estado, loading } = useAuth()

  if (!loading && session) {
    return <Redirect href={getTabHref(role, estado)} />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
