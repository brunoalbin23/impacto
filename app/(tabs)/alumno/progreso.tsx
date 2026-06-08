import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Modal, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { LineChart, BarChart } from 'react-native-chart-kit'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Ejercicio = {
  id: string
  nombre: string
  series: number | null
  repeticiones: string | null
  orden: number
}

type ProgresoRow = {
  fecha: string
  semana: number
  series_realizadas: number | null
  repeticiones_realizadas: string | null
  peso_realizado: number | null
  rpe: number | null
}

type Records = {
  peso_maximo: number | null
  ejercicio_peso_maximo: string | null
  mayor_volumen_sesion: number | null
  racha_dias: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window')
const CHART_W = SCREEN_W - 32

const CHART_CONFIG = {
  backgroundColor: '#0f0f0f',
  backgroundGradientFrom: '#0f0f0f',
  backgroundGradientTo: '#0f0f0f',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(150, 150, 150, ${opacity})`,
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#fff' },
  propsForBackgroundLines: { stroke: '#1e1e1e', strokeDasharray: '' },
}

function shortDate(iso: string): string {
  const [, m, d] = iso.substring(0, 10).split('-')
  return `${d}/${m}`
}

function parseReps(str: string | null): number {
  if (!str) return 0
  const n = parseInt(str, 10)
  return isNaN(n) ? 0 : n
}

function calcVolume(row: ProgresoRow): number {
  return (row.series_realizadas ?? 0) * parseReps(row.repeticiones_realizadas) * (row.peso_realizado ?? 0)
}

function formatVolumen(v: number | null): string {
  if (!v) return '—'
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k kg`
  return `${Math.round(v)} kg`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Progreso() {
  const router = useRouter()
  const { session } = useAuth()

  const [alumnoId, setAlumnoId]           = useState<string | null>(null)
  const [ejercicios, setEjercicios]       = useState<Ejercicio[]>([])
  const [selectedEj, setSelectedEj]       = useState<Ejercicio | null>(null)
  const [showSelector, setShowSelector]   = useState(false)
  const [progreso, setProgreso]           = useState<ProgresoRow[]>([])
  const [records, setRecords]             = useState<Records | null>(null)
  const [loadingInit, setLoadingInit]     = useState(true)
  const [loadingChart, setLoadingChart]   = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // ── Carga inicial: alumnoId, ejercicios, récords ─────────────────────────────
  const loadInit = useCallback(async () => {
    if (!session) return
    setLoadingInit(true)
    setError(null)

    const [dashRes, aidRes] = await Promise.all([
      supabase.rpc('get_dashboard_alumno', { p_alumno_id: session.user.id }),
      supabase.rpc('get_mi_alumno_id'),
    ])

    const row = dashRes.data as any
    const ejs: Ejercicio[] = row?.rutina?.ejercicios ?? []
    setEjercicios(ejs)

    const aid: string | null = aidRes.data ?? null
    setAlumnoId(aid)

    if (aid) {
      const { data: recData } = await supabase.rpc('get_records_alumno', { p_alumno_id: aid })
      if (recData) setRecords(recData as Records)
    }

    if (ejs.length > 0) {
      setSelectedEj(ejs[0])
      await loadProgresoEjercicio(aid, ejs[0].id)
    }

    setLoadingInit(false)
  }, [session])

  useFocusEffect(useCallback(() => { loadInit() }, [loadInit]))

  // ── Carga progreso de ejercicio seleccionado ──────────────────────────────────
  const loadProgresoEjercicio = async (aid: string | null, ejId: string) => {
    if (!aid) return
    setLoadingChart(true)
    const { data, error: err } = await supabase.rpc('get_progreso_ejercicio', {
      p_alumno_id:    aid,
      p_ejercicio_id: ejId,
    })
    if (err) setError('No se pudo cargar el progreso.')
    else setProgreso((data as ProgresoRow[]) ?? [])
    setLoadingChart(false)
  }

  const handleSelectEj = async (ej: Ejercicio) => {
    setSelectedEj(ej)
    setShowSelector(false)
    await loadProgresoEjercicio(alumnoId, ej.id)
  }

  // ── Datos para los gráficos ───────────────────────────────────────────────────

  // LineChart: últimos 8 registros con peso
  const pesoRows = progreso.filter(r => r.peso_realizado != null).slice(-8)
  const lineData = pesoRows.length >= 2
    ? {
        labels:   pesoRows.map(r => shortDate(r.fecha)),
        datasets: [{ data: pesoRows.map(r => r.peso_realizado as number) }],
      }
    : null

  // BarChart: volumen por semana (1–4)
  const volPorSemana = [1, 2, 3, 4].map(s =>
    progreso
      .filter(r => r.semana === s)
      .reduce((acc, r) => acc + calcVolume(r), 0)
  )
  const barData = volPorSemana.some(v => v > 0)
    ? {
        labels:   ['Sem 1', 'Sem 2', 'Sem 3', 'Desc'],
        datasets: [{ data: volPorSemana }],
      }
    : null

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </SafeAreaView>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Selector ejercicio ── */}
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setShowSelector(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.selectorText} numberOfLines={1}>
            {selectedEj ? selectedEj.nombre : 'Seleccioná un ejercicio'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#555" />
        </TouchableOpacity>

        {ejercicios.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={32} color="#222" />
            <Text style={styles.emptyText}>Sin rutina asignada</Text>
          </View>
        )}

        {selectedEj && (
          <>
            {/* ── Gráfica de peso ── */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Evolución del peso</Text>
              {loadingChart ? (
                <View style={styles.chartPlaceholder}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : lineData ? (
                <LineChart
                  data={lineData}
                  width={CHART_W}
                  height={200}
                  chartConfig={CHART_CONFIG}
                  bezier
                  withInnerLines
                  withOuterLines={false}
                  style={styles.chart}
                  yAxisSuffix=" kg"
                />
              ) : (
                <View style={styles.chartPlaceholder}>
                  <Text style={styles.noDataText}>
                    Necesitás al menos 2 registros con peso
                  </Text>
                </View>
              )}
            </View>

            {/* ── Gráfica de volumen semanal ── */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Volumen semanal</Text>
              <Text style={styles.chartSub}>series × reps × kg</Text>
              {loadingChart ? (
                <View style={styles.chartPlaceholder}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : barData ? (
                <BarChart
                  data={barData}
                  width={CHART_W}
                  height={200}
                  chartConfig={CHART_CONFIG}
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines
                  style={styles.chart}
                  yAxisLabel=""
                  yAxisSuffix=""
                />
              ) : (
                <View style={styles.chartPlaceholder}>
                  <Text style={styles.noDataText}>Sin datos de volumen aún</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Récords personales ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trophy-outline" size={18} color="#fff" />
            <Text style={styles.cardTitle}>Récords personales</Text>
          </View>

          {records ? (
            <View style={styles.recordsGrid}>
              <RecordItem
                icon="barbell-outline"
                label="Peso máximo"
                value={records.peso_maximo != null ? `${records.peso_maximo} kg` : '—'}
                sub={records.ejercicio_peso_maximo ?? undefined}
              />
              <RecordItem
                icon="flash-outline"
                label="Mayor volumen"
                value={formatVolumen(records.mayor_volumen_sesion)}
                sub="en una sesión"
              />
              <RecordItem
                icon="flame-outline"
                label="Racha"
                value={records.racha_dias != null ? `${records.racha_dias} días` : '—'}
                sub="consecutivos"
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Empezá a entrenar para ver tus récords</Text>
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Modal selector ejercicio ── */}
      <Modal visible={showSelector} transparent animationType="slide">
        <View style={selStyles.overlay}>
          <View style={selStyles.sheet}>
            <View style={selStyles.handle} />
            <Text style={selStyles.title}>Seleccioná un ejercicio</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ejercicios.map(ej => (
                <TouchableOpacity
                  key={ej.id}
                  style={[
                    selStyles.option,
                    selectedEj?.id === ej.id && selStyles.optionActive,
                  ]}
                  onPress={() => handleSelectEj(ej)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    selStyles.optionText,
                    selectedEj?.id === ej.id && selStyles.optionTextActive,
                  ]}>
                    {ej.nombre}
                  </Text>
                  {selectedEj?.id === ej.id && (
                    <Ionicons name="checkmark" size={16} color="#000" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={selStyles.cancelBtn}
              onPress={() => setShowSelector(false)}
            >
              <Text style={selStyles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Mi progreso</Text>
      <View style={styles.headerBtn} />
    </View>
  )
}

function RecordItem({
  icon, label, value, sub,
}: {
  icon: string; label: string; value: string; sub?: string
}) {
  return (
    <View style={styles.recordItem}>
      <Ionicons name={icon as any} size={22} color="#555" />
      <Text style={styles.recordValue}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
      {sub && <Text style={styles.recordSub}>{sub}</Text>}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  scroll: { padding: 16, gap: 16, paddingBottom: 48 },

  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectorText: { color: '#fff', fontSize: 15, flex: 1, fontWeight: '500' },

  chartCard: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  chartTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  chartSub:   { color: '#444', fontSize: 11 },
  chart: { borderRadius: 8, marginLeft: -16 },
  chartPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: { color: '#333', fontSize: 13, textAlign: 'center' },

  card: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 16,
    padding: 18,
    gap: 16,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:    { fontSize: 15, color: '#fff', fontWeight: '700' },

  recordsGrid:  { flexDirection: 'row', gap: 8 },
  recordItem: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  recordValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
  recordLabel: { color: '#555', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  recordSub:   { color: '#333', fontSize: 10, textAlign: 'center' },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  emptyText:  { color: '#333', fontSize: 14, textAlign: 'center' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a0a0a',
    borderWidth: 1,
    borderColor: '#3a1010',
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#ef4444', fontSize: 14, flex: 1 },
})

const selStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000cc',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 16, color: '#fff', fontWeight: '700', marginBottom: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  optionActive:     { backgroundColor: '#fff' },
  optionText:       { color: '#ccc', fontSize: 15 },
  optionTextActive: { color: '#000', fontWeight: '700' },
  cancelBtn:   { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  cancelText:  { color: '#555', fontSize: 15 },
})
