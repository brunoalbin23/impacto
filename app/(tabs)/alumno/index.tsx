import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Ejercicio = {
  id: string
  nombre: string
  series: number | null
  repeticiones: string | null
  notas: string | null
  orden: number
}

type Rutina = {
  nombre: string
  nivel: string | null
  ejercicios: Ejercicio[]
}

type Cuota = {
  monto: number | null
  estado: string | null
  fecha_vencimiento: string | null
  plan_nombre: string | null
}

type DashboardData = {
  rutina: Rutina | null
  cuota: Cuota | null
}

type Clase = {
  id: string
  nombre: string
  descripcion: string | null
  capacidad_max: number | null
  dias_semana: string[] | string | null
  hora_inicio: string | null
  hora_fin: string | null
  entrenador_nombre: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NIVEL_COLOR: Record<string, string> = {
  Principiante: '#16a34a',
  Intermedio:   '#f59e0b',
  Avanzado:     '#ef4444',
}

const DIAS_ORDER = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
const DIAS_LABEL: Record<string, string> = {
  lun: 'LUN', mar: 'MAR', mie: 'MIÉ',
  jue: 'JUE', vie: 'VIE', sab: 'SÁB', dom: 'DOM',
}

function parseDias(raw: string[] | string | null): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw.replace(/^{|}$/g, '').split(',').filter(Boolean)
}

function formatTime(t: string | null) {
  if (!t) return '—'
  return t.substring(0, 5)
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatMonto(monto: number | null) {
  if (monto == null) return '—'
  return `$${Number(monto).toLocaleString('es-AR')}`
}

function getCuotaStatus(estado: string | null, vencimiento: string | null) {
  if (estado === 'pagado') return { label: 'Pagada', color: '#22c55e' }
  if (vencimiento) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const venc = new Date(vencimiento + 'T00:00:00')
    const diffDias = (venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDias < 0)  return { label: 'Vencida',    color: '#ef4444' }
    if (diffDias <= 5) return { label: 'Por vencer', color: '#f59e0b' }
  }
  return { label: 'Pendiente', color: '#888' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardAlumno() {
  const router = useRouter()
  const { session } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [clases, setClases] = useState<Clase[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const nombre = session?.user?.user_metadata?.nombre as string | undefined
  const firstName = nombre?.split(' ')[0] ?? 'Alumno'

  const load = useCallback(async () => {
    if (!session) return
    const [dashRes, clasesRes] = await Promise.all([
      supabase.rpc('get_dashboard_alumno', { p_alumno_id: session.user.id }),
      supabase.rpc('get_clases_disponibles'),
    ])
    if (dashRes.error) console.error('get_dashboard_alumno error:', dashRes.error)
    if (dashRes.data) {
      const row = dashRes.data as any
      setDashboard({
        rutina: row.rutina ?? null,
        cuota:  row.cuota  ?? null,
      })
    }
    setClases((clasesRes.data as Clase[]) ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [session])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load])
  )

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </SafeAreaView>
    )
  }

  const cuotaStatus = getCuotaStatus(dashboard?.cuota?.estado ?? null, dashboard?.cuota?.fecha_vencimiento ?? null)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.greeting}>Hola, {firstName}</Text>
          <Text style={styles.headerSub}>PANEL DEL ALUMNO</Text>
        </View>

        {/* ── Acciones rápidas ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)/alumno/entrenar')}
            activeOpacity={0.8}
          >
            <Ionicons name="barbell-outline" size={20} color="#000" />
            <Text style={styles.actionBtnText}>Entrenar hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => router.push('/(tabs)/alumno/historial')}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={20} color="#fff" />
            <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>Historial</Text>
          </TouchableOpacity>
        </View>

        {/* ── Mi rutina ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="barbell-outline" size={18} color="#fff" />
            <Text style={styles.cardTitle}>Mi rutina</Text>
          </View>

          {dashboard?.rutina ? (
            <View style={{ gap: 12 }}>
              <View style={styles.rutinaMeta}>
                <Text style={styles.rutinaName}>{dashboard.rutina.nombre}</Text>
                {dashboard.rutina.nivel ? (
                  <View style={[styles.nivelBadge, { borderColor: NIVEL_COLOR[dashboard.rutina.nivel] ?? '#555' }]}>
                    <Text style={[styles.nivelText, { color: NIVEL_COLOR[dashboard.rutina.nivel] ?? '#555' }]}>
                      {dashboard.rutina.nivel}
                    </Text>
                  </View>
                ) : null}
              </View>

              {dashboard.rutina.ejercicios.length > 0 ? (
                <View style={{ gap: 0 }}>
                  <View style={styles.divider} />
                  {dashboard.rutina.ejercicios.map((ej, i) => (
                    <View key={ej.id} style={[styles.ejRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#151515' }]}>
                      <Text style={styles.ejNombre}>{ej.nombre}</Text>
                      <Text style={styles.ejDetalle}>
                        {[
                          ej.series != null ? `${ej.series} series` : null,
                          ej.repeticiones ? `× ${ej.repeticiones}` : null,
                        ].filter(Boolean).join(' ') || '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyHint}>Sin ejercicios cargados.</Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={28} color="#222" />
              <Text style={styles.emptyText}>Aún no tenés rutina asignada</Text>
            </View>
          )}
        </View>

        {/* ── Mi cuota ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="wallet-outline" size={18} color="#fff" />
            <Text style={styles.cardTitle}>Mi cuota</Text>
          </View>

          {dashboard?.cuota ? (
            <View style={{ gap: 0 }}>
              <View style={styles.divider} />
              <View style={styles.cuotaRow}>
                <Text style={styles.cuotaLabel}>Plan</Text>
                <Text style={styles.cuotaValue}>{dashboard.cuota.plan_nombre ?? '—'}</Text>
              </View>
              <View style={[styles.cuotaRow, { borderTopWidth: 1, borderTopColor: '#151515' }]}>
                <Text style={styles.cuotaLabel}>Monto</Text>
                <Text style={styles.cuotaValue}>{formatMonto(dashboard.cuota.monto)}</Text>
              </View>
              <View style={[styles.cuotaRow, { borderTopWidth: 1, borderTopColor: '#151515' }]}>
                <Text style={styles.cuotaLabel}>Vencimiento</Text>
                <Text style={styles.cuotaValue}>{formatFecha(dashboard.cuota.fecha_vencimiento)}</Text>
              </View>
              <View style={[styles.cuotaRow, { borderTopWidth: 1, borderTopColor: '#151515' }]}>
                <Text style={styles.cuotaLabel}>Estado</Text>
                <View style={[styles.estadoBadge, { borderColor: cuotaStatus.color + '66' }]}>
                  <View style={[styles.estadoDot, { backgroundColor: cuotaStatus.color }]} />
                  <Text style={[styles.estadoText, { color: cuotaStatus.color }]}>{cuotaStatus.label}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={28} color="#222" />
              <Text style={styles.emptyText}>Sin cuota asignada</Text>
            </View>
          )}
        </View>

        {/* ── Próximas clases ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.cardTitle}>Clases del gym</Text>
          </View>

          {clases.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={28} color="#222" />
              <Text style={styles.emptyText}>No hay clases disponibles</Text>
            </View>
          ) : (
            <View style={{ gap: 0 }}>
              <View style={styles.divider} />
              {clases.map((clase, i) => {
                const dias = parseDias(clase.dias_semana)
                return (
                  <View key={clase.id} style={[styles.claseRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#151515' }]}>
                    <View style={styles.claseTop}>
                      <Text style={styles.claseNombre}>{clase.nombre}</Text>
                      {(clase.hora_inicio || clase.hora_fin) ? (
                        <View style={styles.horaRow}>
                          <Ionicons name="time-outline" size={12} color="#555" />
                          <Text style={styles.horaText}>{formatTime(clase.hora_inicio)} – {formatTime(clase.hora_fin)}</Text>
                        </View>
                      ) : null}
                    </View>
                    {dias.length > 0 ? (
                      <View style={styles.diasRow}>
                        {DIAS_ORDER.map(d => {
                          const activo = dias.includes(d)
                          return (
                            <View key={d} style={[styles.diaBadge, activo && styles.diaBadgeActive]}>
                              <Text style={[styles.diaText, activo && styles.diaTextActive]}>{DIAS_LABEL[d]}</Text>
                            </View>
                          )
                        })}
                      </View>
                    ) : null}
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* ── Cerrar sesión ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 48 },

  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    marginBottom: 20,
  },
  logo: { width: 200, height: 100, marginBottom: 10 },
  greeting: { fontSize: 20, color: '#fff', fontWeight: '700', marginBottom: 4 },
  headerSub: { fontSize: 11, color: '#444', letterSpacing: 2 },

  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, color: '#fff', fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#1a1a1a' },

  // Rutina
  rutinaMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rutinaName: { fontSize: 17, color: '#fff', fontWeight: '700', flex: 1 },
  nivelBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  nivelText: { fontSize: 11, fontWeight: '600' },
  ejRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 8,
  },
  ejNombre: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 },
  ejDetalle: { color: '#555', fontSize: 13 },

  // Cuota
  cuotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  cuotaLabel: { color: '#555', fontSize: 14 },
  cuotaValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  estadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  estadoDot: { width: 7, height: 7, borderRadius: 4 },
  estadoText: { fontSize: 12, fontWeight: '600' },

  // Clases
  claseRow: { paddingVertical: 12, gap: 8 },
  claseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  claseNombre: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  horaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  horaText: { color: '#555', fontSize: 12 },
  diasRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  diaBadge: {
    paddingVertical: 3, paddingHorizontal: 5,
    borderRadius: 4, backgroundColor: '#161616',
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  diaBadgeActive: { backgroundColor: '#fff', borderColor: '#fff' },
  diaText: { fontSize: 9, color: '#333', fontWeight: '700' },
  diaTextActive: { color: '#000' },

  // Empty
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  emptyText: { color: '#444', fontSize: 14, textAlign: 'center' },
  emptyHint: { color: '#444', fontSize: 13 },

  // Acciones rápidas
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnSecondary: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  actionBtnText:          { color: '#000', fontSize: 15, fontWeight: '700' },
  actionBtnTextSecondary: { color: '#fff' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 4,
    borderWidth: 1, borderColor: '#1a1a1a',
    borderRadius: 10, paddingVertical: 14,
  },
  logoutText: { color: '#555', fontSize: 14, fontWeight: '500' },
})
