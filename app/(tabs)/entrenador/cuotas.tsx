import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type Cuota = {
  id: string
  alumno_id: string
  alumno_nombre: string
  plan_id: string | null
  plan_nombre: string | null
  fecha_vencimiento: string
  monto: number
  metodo_pago: string
  estado: string
  fecha_pago: string | null
  created_at: string
}

type Filtro = 'todos' | 'pendientes' | 'vencidos' | 'pagados'
type EstadoVisual = 'pagado' | 'vencido' | 'por_vencer' | 'pendiente'

function getEstadoVisual(cuota: Cuota): EstadoVisual {
  if (cuota.estado === 'pagado') return 'pagado'
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(cuota.fecha_vencimiento + 'T00:00:00')
  if (venc < hoy) return 'vencido'
  const enSieteDias = new Date(hoy)
  enSieteDias.setDate(hoy.getDate() + 7)
  if (venc <= enSieteDias) return 'por_vencer'
  return 'pendiente'
}

const ESTADO_CONFIG: Record<EstadoVisual, { color: string; bg: string; label: string }> = {
  pagado:    { color: '#22c55e', bg: '#22c55e18', label: 'Pagado' },
  vencido:   { color: '#ef4444', bg: '#ef444418', label: 'Vencido' },
  por_vencer:{ color: '#f59e0b', bg: '#f59e0b18', label: 'Por vencer' },
  pendiente: { color: '#555',    bg: '#1e1e1e',   label: 'Pendiente' },
}

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',      label: 'Todos' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'vencidos',   label: 'Vencidos' },
  { key: 'pagados',    label: 'Pagados' },
]

function formatDate(str: string): string {
  return new Date(str + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function Cuotas() {
  const router = useRouter()
  const { session } = useAuth()
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const fetchCuotas = useCallback(async () => {
    if (!session) return
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('get_cuotas_entrenador')
      if (err) throw err
      setCuotas((data as Cuota[]) ?? [])
    } catch (e: any) {
      setError('No se pudieron cargar las cuotas.')
      console.error('fetchCuotas:', e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      fetchCuotas()
    }, [fetchCuotas])
  )

  const cuotasFiltradas = useMemo(() => {
    return cuotas.filter(item => {
      if (filtro === 'todos') return true
      const ev = getEstadoVisual(item)
      if (filtro === 'pendientes') return ev === 'pendiente' || ev === 'por_vencer'
      if (filtro === 'vencidos')   return ev === 'vencido'
      if (filtro === 'pagados')    return ev === 'pagado'
      return true
    })
  }, [cuotas, filtro])

  const renderCuota = ({ item }: { item: Cuota }) => {
    const ev = getEstadoVisual(item)
    const cfg = ESTADO_CONFIG[ev]

    return (
      <TouchableOpacity
        style={[
          styles.card,
          ev === 'vencido'    && styles.cardVencido,
          ev === 'por_vencer' && styles.cardPorVencer,
        ]}
        onPress={() => router.push(`/(tabs)/entrenador/cuotas/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardNombre} numberOfLines={1}>{item.alumno_nombre}</Text>
          <View style={[styles.estadoBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.estadoText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardMonto}>${Number(item.monto).toLocaleString('es-AR')}</Text>
          <Text style={styles.cardFecha}>Vence {formatDate(item.fecha_vencimiento)}</Text>
        </View>

        {item.plan_nombre ? (
          <Text style={styles.cardPlan}>{item.plan_nombre}</Text>
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
        <Text style={styles.headerTitle}>Cuotas</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.filtrosWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosScroll}
        >
          {FILTROS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filtroBtn, filtro === f.key && styles.filtroBtnActive]}
              onPress={() => setFiltro(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filtroText, filtro === f.key && styles.filtroTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#555" />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={fetchCuotas} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={cuotasFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={renderCuota}
          contentContainerStyle={cuotasFiltradas.length === 0 ? styles.center : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => { setLoading(true); fetchCuotas() }}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={52} color="#222" />
              <Text style={styles.emptyTitle}>Sin cuotas</Text>
              <Text style={styles.emptyText}>
                {filtro === 'todos'
                  ? 'Todavía no hay cuotas registradas.'
                  : 'No hay cuotas en esta categoría.'}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/entrenador/cuotas/nueva' as any)}
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
  filtrosWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    paddingVertical: 10,
  },
  filtrosScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filtroBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0f0f0f',
  },
  filtroBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  filtroText: { color: '#555', fontSize: 13, fontWeight: '500' },
  filtroTextActive: { color: '#000' },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardVencido: {
    borderColor: '#ef444428',
    backgroundColor: '#150a0a',
  },
  cardPorVencer: {
    borderColor: '#f59e0b28',
    backgroundColor: '#14110a',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNombre: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  estadoBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardMonto: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cardFecha: { color: '#555', fontSize: 13 },
  cardPlan: { color: '#444', fontSize: 12 },
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
