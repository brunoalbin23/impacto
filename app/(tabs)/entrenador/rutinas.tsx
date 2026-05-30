import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RutinaResumen = {
  id: string
  nombre: string
  descripcion: string | null
  nivel: string | null
  num_ejercicios: number
  created_at: string
}

const NIVEL_COLOR: Record<string, string> = {
  Principiante: '#16a34a',
  Intermedio:   '#f59e0b',
  Avanzado:     '#ef4444',
}

export default function Rutinas() {
  const router = useRouter()
  const [rutinas, setRutinas] = useState<RutinaResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRutinas = useCallback(async () => {
    setError(null)
    const { data, error: err } = await supabase.rpc('get_mis_rutinas')
    setLoading(false)
    if (err) { setError('No se pudieron cargar las rutinas.'); return }
    setRutinas((data as RutinaResumen[]) ?? [])
  }, [])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchRutinas()
    }, [fetchRutinas])
  )

  const renderRutina = ({ item }: { item: RutinaResumen }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/entrenador/rutinas/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardNombre} numberOfLines={1}>{item.nombre}</Text>
        {item.nivel ? (
          <View style={[styles.nivelBadge, { borderColor: NIVEL_COLOR[item.nivel] ?? '#555' }]}>
            <Text style={[styles.nivelText, { color: NIVEL_COLOR[item.nivel] ?? '#555' }]}>
              {item.nivel}
            </Text>
          </View>
        ) : null}
      </View>
      {item.descripcion ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{item.descripcion}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Ionicons name="barbell-outline" size={13} color="#444" />
        <Text style={styles.cardCount}>
          {item.num_ejercicios} {item.num_ejercicios === 1 ? 'ejercicio' : 'ejercicios'}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rutinas</Text>
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
          <TouchableOpacity onPress={() => { setLoading(true); fetchRutinas() }} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rutinas}
          keyExtractor={(item) => item.id}
          renderItem={renderRutina}
          contentContainerStyle={rutinas.length === 0 ? styles.center : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => { setLoading(true); fetchRutinas() }}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="barbell-outline" size={52} color="#222" />
              <Text style={styles.emptyTitle}>Sin rutinas</Text>
              <Text style={styles.emptyText}>Creá tu primera rutina con el botón +</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/entrenador/rutinas/nuevo' as any)}
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
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardNombre: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  nivelBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nivelText: { fontSize: 11, fontWeight: '600' },
  cardDesc: { color: '#555', fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardCount: { color: '#444', fontSize: 12 },
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
