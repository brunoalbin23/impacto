import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

const SECTIONS = [
  {
    key: 'alumnos',
    label: 'Alumnos',
    icon: 'people-outline' as const,
    href: '/(tabs)/entrenador/alumnos',
  },
  {
    key: 'cuotas',
    label: 'Cuotas',
    icon: 'wallet-outline' as const,
    href: '/(tabs)/entrenador/cuotas',
  },
  {
    key: 'clases',
    label: 'Clases',
    icon: 'calendar-outline' as const,
    href: '/(tabs)/entrenador/clases',
  },
  {
    key: 'asistencia',
    label: 'Asistencia',
    icon: 'checkmark-circle-outline' as const,
    href: '/(tabs)/entrenador/asistencia',
  },
] as const

export default function EntrenadorDashboard() {
  const router = useRouter()
  const { session } = useAuth()
  const { width } = useWindowDimensions()
  const cardSize = (width - 48) / 2

  const nombre = session?.user?.user_metadata?.nombre as string | undefined
  const firstName = nombre?.split(' ')[0] ?? session?.user?.email?.split('@')[0] ?? 'Entrenador'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.greeting}>Hola, {firstName}</Text>
          <Text style={styles.subtitle}>PANEL DEL ENTRENADOR</Text>
        </View>

        <View style={styles.grid}>
          {SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.key}
              style={[styles.card, { width: cardSize, height: cardSize }]}
              onPress={() => router.push(section.href)}
              activeOpacity={0.7}
            >
              <Ionicons name={section.icon} size={36} color="#fff" />
              <View style={styles.cardFooter}>
                <Text style={styles.cardLabel}>{section.label}</Text>
                <Ionicons name="chevron-forward" size={14} color="#444" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => supabase.auth.signOut()}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={16} color="#555" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    marginBottom: 24,
  },
  logo: {
    width: 220,
    height: 110,
    marginBottom: 12,
  },
  greeting: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#444',
    letterSpacing: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 14,
  },
  logoutText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '500',
  },
})
