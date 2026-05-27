import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type AlumnoConPerfil = {
  id: string
  profile_id: string
  objetivo: string | null
  estado: string
  fecha_inicio: string | null
  nombre: string
  email: string
  telefono: string | null
}

function getInitials(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export default function Alumnos() {
  const router = useRouter()
  const { session } = useAuth()
  const [alumnos, setAlumnos] = useState<AlumnoConPerfil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlumnos = useCallback(async () => {
    if (!session) return
    setError(null)
    try {
      const { data, error: err } = await supabase
        .rpc('get_mis_alumnos')

      if (err) throw err
      setAlumnos((data as AlumnoConPerfil[]) ?? [])
    } catch (e: any) {
      setError('No se pudieron cargar los alumnos.')
      console.error('fetchAlumnos:', e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchAlumnos()
    }, [fetchAlumnos])
  )

  const renderAlumno = ({ item }: { item: AlumnoConPerfil }) => {
    const nombre = item.nombre ?? 'Sin nombre'
    const email = item.email ?? '—'
    const activo = item.estado === 'activo'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(tabs)/entrenador/alumno/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(nombre)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardNombre} numberOfLines={1}>{nombre}</Text>
          <Text style={styles.cardEmail} numberOfLines={1}>{email}</Text>
          <View style={styles.estadoBadge}>
            <View style={[styles.estadoDot, { backgroundColor: activo ? '#22c55e' : '#555' }]} />
            <Text style={[styles.estadoText, { color: activo ? '#22c55e' : '#555' }]}>
              {activo ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#333" />
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alumnos</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#555" />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={fetchAlumnos} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={alumnos}
          keyExtractor={(item) => item.id}
          renderItem={renderAlumno}
          contentContainerStyle={alumnos.length === 0 ? styles.center : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchAlumnos}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={52} color="#222" />
              <Text style={styles.emptyTitle}>Sin alumnos</Text>
              <Text style={styles.emptyText}>Todavía no tenés alumnos cargados.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/entrenador/alumno/nuevo' as any)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  headerBtn: { width: 36 },
  headerTitle: { fontSize: 17, color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardInfo: { flex: 1, gap: 2 },
  cardNombre: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardEmail: { color: '#555', fontSize: 13 },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  estadoDot: { width: 7, height: 7, borderRadius: 4 },
  estadoText: { fontSize: 12, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1, borderColor: '#222', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20, marginTop: 4,
  },
  retryText: { color: '#888', fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
})
