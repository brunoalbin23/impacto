import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/lib/auth-context'

export default function Index() {
  const { loading, session, role, estado } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />
  }

  if (role === 'entrenador') {
    return <Redirect href="/(tabs)/entrenador" />
  }

  if (estado === 'pendiente') {
    return <Redirect href="/(tabs)/alumno/pendiente" />
  }

  if (estado === 'rechazado') {
    return <Redirect href="/(tabs)/alumno/rechazado" />
  }

  return <Redirect href="/(tabs)/alumno" />
}
