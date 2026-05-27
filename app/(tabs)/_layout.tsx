import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth-context'

export default function TabsLayout() {
  const { session, loading } = useAuth()

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
