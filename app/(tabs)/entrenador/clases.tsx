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

type Clase = {
  id: string
  nombre: string
  descripcion: string | null
  capacidad_max: number | null
  dias_semana: string[] | string | null
  hora_inicio: string | null
  hora_fin: string | null
  created_at: string
}

const DIAS_ORDER = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
const DIAS_LABEL: Record<string, string> = {
  lun: 'LUN', mar: 'MAR', mie: 'MIÉ',
  jue: 'JUE', vie: 'VIE', sab: 'SÁB', dom: 'DOM',
}

function parseDias(raw: string[] | string | null): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  // Postgres puede devolver el array como string '{lun,mar}'
  return raw.replace(/^{|}$/g, '').split(',').filter(Boolean)
}

function formatTime(t: string | null): string {
  if (!t) return '—'
  return t.substring(0, 5)
}

export default function Clases() {
  const router = useRouter()
  const { session } = useAuth()
  const [clases, setClases] = useState<Clase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClases = useCallback(async () => {
    if (!session) return
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('get_mis_clases')
      if (err) throw err
      setClases((data as Clase[]) ?? [])
    } catch (e: any) {
      setError('No se pudieron cargar las clases.')
      console.error('fetchClases:', e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchClases()
    }, [fetchClases])
  )

  const renderClase = ({ item }: { item: Clase }) => {
    const dias = parseDias(item.dias_semana)
    const tieneHorario = item.hora_inicio || item.hora_fin

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(tabs)/entrenador/clases/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardNombre} numberOfLines={1}>{item.nombre}</Text>
          {item.capacidad_max != null && (
            <View style={styles.capacidadBadge}>
              <Ionicons name="people-outline" size={12} color="#555" />
              <Text style={styles.capacidadText}>{item.capacidad_max}</Text>
            </View>
          )}
        </View>

        {dias.length > 0 && (
          <View style={styles.diasRow}>
            {DIAS_ORDER.map(d => {
              const activo = dias.includes(d)
              return (
                <View key={d} style={[styles.diaBadge, activo && styles.diaBadgeActive]}>
                  <Text style={[styles.diaText, activo && styles.diaTextActive]}>
                    {DIAS_LABEL[d]}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {tieneHorario ? (
          <View style={styles.horaRow}>
            <Ionicons name="time-outline" size={13} color="#555" />
            <Text style={styles.horaText}>
              {formatTime(item.hora_inicio)} – {formatTime(item.hora_fin)}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clases</Text>
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
          <TouchableOpacity onPress={fetchClases} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={clases}
          keyExtractor={item => item.id}
          renderItem={renderClase}
          contentContainerStyle={clases.length === 0 ? styles.center : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => { setLoading(true); fetchClases() }}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="barbell-outline" size={52} color="#222" />
              <Text style={styles.emptyTitle}>Sin clases</Text>
              <Text style={styles.emptyText}>Todavía no tenés clases cargadas.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/entrenador/clases/nuevo' as any)}
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
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNombre: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  capacidadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a1a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  capacidadText: { color: '#555', fontSize: 12, fontWeight: '500' },
  diasRow: { flexDirection: 'row', gap: 4 },
  diaBadge: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 5,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  diaBadgeActive: { backgroundColor: '#fff', borderColor: '#fff' },
  diaText: { fontSize: 10, color: '#333', fontWeight: '700' },
  diaTextActive: { color: '#000' },
  horaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  horaText: { color: '#555', fontSize: 13 },
  emptyContainer: { alignItems: 'center', gap: 10 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
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
