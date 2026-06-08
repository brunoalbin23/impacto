import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { LineChart, BarChart } from 'react-native-chart-kit'
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

type SensRow = {
  semana_num: number
  fecha_inicio: string
  energia_promedio: number | null
  fatiga_promedio: number | null
  sueno_promedio: number | null
  estado_animo_promedio: number | null
  total_registros: number
}

type RegistroEjercicio = {
  ejercicio_id: string
  ejercicio_nombre: string
  series_planificadas: number | null
  repeticiones_planificadas: string | null
  series_realizadas: number | null
  repeticiones_realizadas: string | null
  peso_realizado: number | null
  rpe: number | null
}

type RegistroEntreno = {
  fecha: string
  ejercicios: RegistroEjercicio[]
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

const SEMANAS = [
  { n: 1, label: 'Sem. 1' },
  { n: 2, label: 'Sem. 2' },
  { n: 3, label: 'Sem. 3' },
  { n: 4, label: 'Descarga' },
]

function shortDate(iso: string) {
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

function metricBar(val: number | null) {
  const v = val ?? 0
  const filled = Math.round(v)
  return Array.from({ length: 10 }, (_, i) => (
    <View key={i} style={[metStyles.bar, i < filled && metStyles.barFilled]} />
  ))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgresoDetalle() {
  const router = useRouter()
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre: string }>()
  const alumnoNombre = nombre ?? 'Alumno'

  const [ejercicios, setEjercicios]     = useState<Ejercicio[]>([])
  const [selectedEj, setSelectedEj]     = useState<Ejercicio | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [progreso, setProgreso]         = useState<ProgresoRow[]>([])
  const [records, setRecords]           = useState<Records | null>(null)
  const [sensaciones, setSensaciones]   = useState<SensRow[]>([])
  const [historial, setHistorial]       = useState<RegistroEntreno[]>([])
  const [semanaHist, setSemanaHist]     = useState(1)
  const [loadingInit, setLoadingInit]   = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)
  const [loadingHist, setLoadingHist]   = useState(false)

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const loadInit = useCallback(async () => {
    if (!id) return
    setLoadingInit(true)

    // Ejercicios de la rutina
    let ejs: Ejercicio[] = []
    const { data: rutinaData } = await supabase.rpc('get_rutina_alumno', { p_alumno_id: id })
    const rutina = Array.isArray(rutinaData) ? rutinaData[0] : rutinaData
    if (rutina?.rutina_id) {
      const { data: rutDetalle } = await supabase.rpc('get_rutina', { p_id: rutina.rutina_id })
      const det = Array.isArray(rutDetalle) ? rutDetalle[0] : rutDetalle
      ejs = det?.ejercicios ?? []
    }
    setEjercicios(ejs)

    // Records, sensaciones e historial en paralelo
    const [recRes, sensRes, histRes] = await Promise.all([
      supabase.rpc('get_records_alumno', { p_alumno_id: id }),
      supabase.rpc('get_sensaciones_alumno', { p_alumno_id: id }),
      supabase.rpc('get_resumen_semanal', { p_alumno_id: id, p_semana: 1 }),
    ])
    if (recRes.data)  setRecords(recRes.data as Records)
    console.log('sensaciones raw data:', JSON.stringify(sensRes.data))
    console.log('sensaciones error:', JSON.stringify(sensRes.error))
    setSensaciones((sensRes.data as SensRow[]) ?? [])
    setHistorial((histRes.data as RegistroEntreno[]) ?? [])

    // Auto-seleccionar primer ejercicio
    if (ejs.length > 0) {
      setSelectedEj(ejs[0])
      await loadProgreso(ejs[0].id)
    }

    setLoadingInit(false)
  }, [id])

  useFocusEffect(useCallback(() => { loadInit() }, [loadInit]))

  const loadProgreso = async (ejId: string) => {
    if (!id) return
    setLoadingChart(true)
    const { data } = await supabase.rpc('get_progreso_ejercicio', {
      p_alumno_id:    id,
      p_ejercicio_id: ejId,
    })
    setProgreso((data as ProgresoRow[]) ?? [])
    setLoadingChart(false)
  }

  const loadHistorial = async (semana: number) => {
    if (!id) return
    setLoadingHist(true)
    const { data } = await supabase.rpc('get_resumen_semanal', {
      p_alumno_id: id,
      p_semana:    semana,
    })
    setHistorial((data as RegistroEntreno[]) ?? [])
    setLoadingHist(false)
  }

  const handleSelectEj = async (ej: Ejercicio) => {
    setSelectedEj(ej)
    setShowSelector(false)
    await loadProgreso(ej.id)
  }

  const handleSemanaHist = (s: number) => {
    setSemanaHist(s)
    loadHistorial(s)
  }

  // ── Datos para gráficos ────────────────────────────────────────────────────
  const pesoRows = progreso.filter(r => r.peso_realizado != null).slice(-8)
  const lineData = pesoRows.length >= 2
    ? {
        labels:   pesoRows.map(r => shortDate(r.fecha)),
        datasets: [{ data: pesoRows.map(r => r.peso_realizado as number) }],
      }
    : null

  const volPorSemana = [1, 2, 3, 4].map(s =>
    progreso.filter(r => r.semana === s).reduce((acc, r) => acc + calcVolume(r), 0)
  )
  const barData = volPorSemana.some(v => v > 0)
    ? { labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Desc'], datasets: [{ data: volPorSemana }] }
    : null

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header nombre={alumnoNombre} onBack={() => router.back()} />
        <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header nombre={alumnoNombre} onBack={() => router.back()} />

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
            {selectedEj ? selectedEj.nombre : 'Sin rutina asignada'}
          </Text>
          {ejercicios.length > 0 && <Ionicons name="chevron-down" size={16} color="#555" />}
        </TouchableOpacity>

        {selectedEj && (
          <>
            {/* ── Evolución del peso ── */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Evolución del peso</Text>
              {loadingChart ? (
                <View style={styles.chartPlaceholder}><ActivityIndicator color="#fff" /></View>
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
                  <Text style={styles.noDataText}>Necesitás al menos 2 registros con peso</Text>
                </View>
              )}
            </View>

            {/* ── Volumen semanal ── */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Volumen semanal</Text>
              <Text style={styles.chartSub}>series × reps × kg</Text>
              {loadingChart ? (
                <View style={styles.chartPlaceholder}><ActivityIndicator color="#fff" /></View>
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

        {/* ── Récords ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trophy-outline" size={18} color="#fff" />
            <Text style={styles.cardTitle}>Récords personales</Text>
          </View>
          {records && (records.peso_maximo || records.mayor_volumen_sesion || records.racha_dias) ? (
            <View style={styles.recordsGrid}>
              <RecordItem icon="barbell-outline" label="Peso máx."
                value={records.peso_maximo != null ? `${records.peso_maximo} kg` : '—'}
                sub={records.ejercicio_peso_maximo ?? undefined} />
              <RecordItem icon="flash-outline" label="Volumen"
                value={formatVolumen(records.mayor_volumen_sesion)}
                sub="mayor sesión" />
              <RecordItem icon="flame-outline" label="Racha"
                value={records.racha_dias != null ? `${records.racha_dias} días` : '—'}
                sub="consecutivos" />
            </View>
          ) : (
            <Text style={styles.noDataText}>Sin entrenamientos registrados aún</Text>
          )}
        </View>

        {/* ── Sensaciones promedio ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="pulse-outline" size={18} color="#fff" />
            <Text style={styles.cardTitle}>Sensaciones promedio</Text>
          </View>
          {sensaciones.length > 0 ? sensaciones.map(s => (
            <View key={s.semana_num} style={styles.sensRow}>
              <Text style={styles.sensWeek}>Semana {s.semana_num}</Text>
              <View style={styles.sensCols}>
                <SensMetric label="Energía" val={s.energia_promedio} />
                <SensMetric label="Fatiga"  val={s.fatiga_promedio} />
                <SensMetric label="Sueño"   val={s.sueno_promedio} />
                <SensMetric label="Ánimo"   val={s.estado_animo_promedio} />
              </View>
            </View>
          )) : (
            <Text style={styles.noDataText}>Sin registros de sensaciones aún</Text>
          )}
        </View>

        {/* ── Historial de entrenamientos ── */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="list-outline" size={18} color="#fff" />
            <Text style={styles.cardTitle}>Historial</Text>
          </View>

          {/* Selector semana */}
          <View style={styles.semanaRow}>
            {SEMANAS.map(s => (
              <TouchableOpacity
                key={s.n}
                style={[styles.semanaBtn, semanaHist === s.n && styles.semanaBtnActive]}
                onPress={() => handleSemanaHist(s.n)}
                activeOpacity={0.7}
              >
                <Text style={[styles.semanaBtnText, semanaHist === s.n && styles.semanaBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingHist ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : historial.length === 0 ? (
            <Text style={styles.noDataText}>Sin registros para esta semana</Text>
          ) : (
            historial.map((reg, i) => (
              <View key={i} style={[styles.histCard, i > 0 && { marginTop: 10 }]}>
                <View style={styles.histHeader}>
                  <Ionicons name="calendar-outline" size={14} color="#555" />
                  <Text style={styles.histFecha}>{shortDate(reg.fecha)}</Text>
                </View>
                {/* Cabecera columnas */}
                <View style={styles.histColRow}>
                  <Text style={[styles.histCol, { flex: 2 }]}>Ejercicio</Text>
                  <Text style={styles.histCol}>Plan</Text>
                  <Text style={styles.histCol}>Real</Text>
                  <Text style={styles.histCol}>Kg</Text>
                  <Text style={styles.histCol}>RPE</Text>
                </View>
                {reg.ejercicios.map((ej, j) => (
                  <View key={j} style={[styles.histEjRow, j % 2 === 1 && styles.histEjAlt]}>
                    <Text style={[styles.histCell, { flex: 2 }]} numberOfLines={1}>
                      {ej.ejercicio_nombre}
                    </Text>
                    <Text style={styles.histCell}>
                      {ej.series_planificadas != null
                        ? `${ej.series_planificadas}×${ej.repeticiones_planificadas ?? '?'}`
                        : '—'}
                    </Text>
                    <Text style={styles.histCell}>
                      {ej.series_realizadas != null
                        ? `${ej.series_realizadas}×${ej.repeticiones_realizadas ?? '?'}`
                        : '—'}
                    </Text>
                    <Text style={styles.histCell}>
                      {ej.peso_realizado != null ? `${ej.peso_realizado}` : '—'}
                    </Text>
                    <Text style={[styles.histCell, ej.rpe != null && styles.rpeCell]}>
                      {ej.rpe ?? '—'}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Modal selector ejercicio ── */}
      {showSelector && (
        <View style={selStyles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowSelector(false)} />
          <View style={selStyles.sheet}>
            <View style={selStyles.handle} />
            <Text style={selStyles.title}>Seleccioná un ejercicio</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ejercicios.map(ej => (
                <TouchableOpacity
                  key={ej.id}
                  style={[selStyles.option, selectedEj?.id === ej.id && selStyles.optionActive]}
                  onPress={() => handleSelectEj(ej)}
                  activeOpacity={0.7}
                >
                  <Text style={[selStyles.optionText, selectedEj?.id === ej.id && selStyles.optionTextActive]}>
                    {ej.nombre}
                  </Text>
                  {selectedEj?.id === ej.id && <Ionicons name="checkmark" size={16} color="#000" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={selStyles.cancelBtn} onPress={() => setShowSelector(false)}>
              <Text style={selStyles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Header({ nombre, onBack }: { nombre: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{nombre}</Text>
      <View style={styles.headerBtn} />
    </View>
  )
}

function RecordItem({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.recordItem}>
      <Ionicons name={icon as any} size={20} color="#555" />
      <Text style={styles.recordValue}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
      {sub && <Text style={styles.recordSub}>{sub}</Text>}
    </View>
  )
}

function SensMetric({ label, val }: { label: string; val: number | null }) {
  return (
    <View style={metStyles.col}>
      <Text style={metStyles.label}>{label}</Text>
      <Text style={metStyles.val}>{val ?? '—'}</Text>
      <View style={metStyles.bars}>{metricBar(val)}</View>
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
  headerTitle: { fontSize: 17, color: '#fff', fontWeight: '600', flex: 1, textAlign: 'center' },
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
  chart:      { borderRadius: 8, marginLeft: -16 },
  chartPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: { color: '#333', fontSize: 13 },

  card: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:    { fontSize: 15, color: '#fff', fontWeight: '700' },

  recordsGrid: { flexDirection: 'row', gap: 8 },
  recordItem: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 3,
  },
  recordValue: { color: '#fff', fontSize: 14, fontWeight: '800' },
  recordLabel: { color: '#555', fontSize: 9, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  recordSub:   { color: '#333', fontSize: 9, textAlign: 'center' },

  // Sensaciones
  sensRow:  { gap: 8 },
  sensWeek: { color: '#555', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  sensCols: { flexDirection: 'row', gap: 8 },

  // Semana selector
  semanaRow: { flexDirection: 'row', gap: 6 },
  semanaBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
  },
  semanaBtnActive:     { backgroundColor: '#fff', borderColor: '#fff' },
  semanaBtnText:       { color: '#444', fontSize: 11, fontWeight: '600' },
  semanaBtnTextActive: { color: '#000' },

  // Historial
  histCard: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 10,
    overflow: 'hidden',
  },
  histHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  histFecha: { color: '#555', fontSize: 12, fontWeight: '600' },
  histColRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  histCol:   { flex: 1, fontSize: 9, color: '#333', fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  histEjRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  histEjAlt: { backgroundColor: '#080808' },
  histCell:  { flex: 1, color: '#777', fontSize: 11, textAlign: 'center' },
  rpeCell:   { color: '#fff', fontWeight: '700' },
})

const metStyles = StyleSheet.create({
  col:   { flex: 1, alignItems: 'center', gap: 4 },
  label: { color: '#555', fontSize: 9, fontWeight: '600', letterSpacing: 0.3 },
  val:   { color: '#fff', fontSize: 14, fontWeight: '800' },
  bars:  { flexDirection: 'row', gap: 1, height: 4 },
  bar:   { flex: 1, height: 4, backgroundColor: '#1e1e1e', borderRadius: 2 },
  barFilled: { backgroundColor: '#fff' },
})

const selStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000cc',
    justifyContent: 'flex-end',
    zIndex: 100,
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
  title:            { fontSize: 16, color: '#fff', fontWeight: '700', marginBottom: 12 },
  option:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  optionActive:     { backgroundColor: '#fff' },
  optionText:       { color: '#ccc', fontSize: 15 },
  optionTextActive: { color: '#000', fontWeight: '700' },
  cancelBtn:        { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  cancelText:       { color: '#555', fontSize: 15 },
})
