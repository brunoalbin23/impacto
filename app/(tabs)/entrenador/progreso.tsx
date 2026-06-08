import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Alumno = {
  id: string
  nombre: string
  email: string
  objetivo: string | null
  estado: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgresoAlumnos() {
  const router = useRouter()
  const [alumnos, setAlumnos]     = useState<Alumno[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const { data, error: err } = await supabase.rpc('get_mis_alumnos')
    if (err) setError('No se pudieron cargar los alumnos.')
    const todos = (data as Alumno[]) ?? []
    setAlumnos(todos.filter(a => a.estado === 'activo'))
    setLoading(false)
    setRefreshing(false)
  }, [])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load()
  }, [load]))

  const onRefresh = () => { setRefreshing(true); load() }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={() => router.back()} />
      <FlatList
        data={alumnos}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={32} color="#222" />
              <Text style={styles.emptyText}>Sin alumnos activos</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({
              pathname: '/(tabs)/entrenador/progreso/[id]' as any,
              params: { id: item.id, nombre: item.nombre },
            })}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
              {item.objetivo && (
                <Text style={styles.objetivo} numberOfLines={1}>{item.objetivo}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#333" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Progreso de alumnos</Text>
      <View style={styles.headerBtn} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  headerBtn:   { width: 36 },
  headerTitle: { fontSize: 17, color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 14,
    padding: 14,
  },
  avatar: {
    width: 42, height: 42,
    borderRadius: 21,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  info:      { flex: 1, gap: 2 },
  nombre:    { color: '#fff', fontSize: 15, fontWeight: '600' },
  email:     { color: '#555', fontSize: 12 },
  objetivo:  { color: '#333', fontSize: 11, marginTop: 2 },

  emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText:  { color: '#333', fontSize: 14 },
  errorText:  { color: '#ef4444', fontSize: 14 },
})
