import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
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

type EjInput = {
  series: string
  reps: string
  peso: string
  rpe: number | null
  rir: string
  notas: string
}

type NumericSensKey = 'energia' | 'fatiga' | 'sueno' | 'estado_animo'

type SensForm = {
  energia: number
  fatiga: number
  sueno: number
  estado_animo: number
  dolor: string
  comentarios: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEMANAS = [
  { n: 1, label: 'Sem. 1' },
  { n: 2, label: 'Sem. 2' },
  { n: 3, label: 'Sem. 3' },
  { n: 4, label: 'Descarga' },
]

const SENS_METRICS: { key: NumericSensKey; label: string }[] = [
  { key: 'energia',      label: 'Energía' },
  { key: 'fatiga',       label: 'Fatiga' },
  { key: 'sueno',        label: 'Sueño' },
  { key: 'estado_animo', label: 'Estado de ánimo' },
]

function formatFechaHoy(): string {
  const hoy = new Date()
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${dias[hoy.getDay()]} ${hoy.getDate()} de ${meses[hoy.getMonth()]}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EntrenarHoy() {
  const router = useRouter()
  const { session } = useAuth()

  const [semana, setSemana] = useState(1)
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [alumnoId, setAlumnoId] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, EjInput>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSens, setShowSens] = useState(false)
  const [savingSens, setSavingSens] = useState(false)
  const [sens, setSens] = useState<SensForm>({
    energia: 5, fatiga: 5, sueno: 5, estado_animo: 5,
    dolor: '', comentarios: '',
  })

  const fecha = new Date().toISOString().split('T')[0]

  const loadRutina = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_dashboard_alumno', {
      p_alumno_id: session.user.id,
    })
    if (err) {
      setError('No se pudo cargar la rutina.')
      setLoading(false)
      return
    }
    const row = data as any
    const ejs: Ejercicio[] = row?.rutina?.ejercicios ?? []
    setEjercicios(ejs)

    const { data: aid } = await supabase.rpc('get_mi_alumno_id')
    console.log('DEBUG alumno_id:', aid)
    setAlumnoId(aid ?? null)
    const init: Record<string, EjInput> = {}
    ejs.forEach(e => {
      init[e.id] = { series: '', reps: '', peso: '', rpe: null, rir: '', notas: '' }
    })
    setInputs(init)
    setLoading(false)
  }, [session])

  useFocusEffect(useCallback(() => { loadRutina() }, [loadRutina]))

  const updateInput = (id: string, field: keyof EjInput, value: any) => {
    setInputs(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleGuardar = async () => {
    if (!session) return
    console.log('GUARDAR session.user.id:', session.user.id)
    console.log('GUARDAR alumnoId:', alumnoId)
    console.log('GUARDAR ejercicios:', JSON.stringify(ejercicios))
    if (!alumnoId) { setError('No se encontró el registro del alumno.'); return }
    if (ejercicios.length === 0) { setError('No hay ejercicios en tu rutina.'); return }
    setSaving(true)
    setError(null)
    try {
      await Promise.all(
        ejercicios.map(ej => {
          const inp = inputs[ej.id] ?? {}
          return supabase.rpc('registrar_entreno', {
            p_alumno_id:               alumnoId,
            p_ejercicio_id:            ej.id,
            p_fecha:                   fecha,
            p_semana:                  semana,
            p_series_realizadas:       inp.series ? parseInt(inp.series) : null,
            p_repeticiones_realizadas: inp.reps   || null,
            p_peso_realizado:          inp.peso   ? parseFloat(inp.peso) : null,
            p_rpe:                     inp.rpe,
            p_rir:                     inp.rir    ? parseInt(inp.rir) : null,
            p_notas:                   inp.notas  || null,
          })
        })
      )
      setShowSens(true)
    } catch (e: any) {
      setError('Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleFinalizar = async () => {
    if (!session || !alumnoId) { setShowSens(false); router.back(); return }
    setSavingSens(true)
    try {
      await supabase.rpc('registrar_sensaciones', {
        p_alumno_id:    alumnoId,
        p_fecha:        fecha,
        p_energia:      sens.energia,
        p_fatiga:       sens.fatiga,
        p_sueno:        sens.sueno,
        p_dolor:        sens.dolor        || null,
        p_estado_animo: sens.estado_animo,
        p_comentarios:  sens.comentarios  || null,
      })
    } catch {
      // sensaciones son opcionales, no bloqueamos si falla
    } finally {
      setSavingSens(false)
      setShowSens(false)
      router.back()
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </SafeAreaView>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Header onBack={() => router.back()} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Fecha */}
          <Text style={styles.fecha}>{formatFechaHoy()}</Text>

          {/* Selector semana */}
          <View style={styles.semanaRow}>
            {SEMANAS.map(s => (
              <TouchableOpacity
                key={s.n}
                style={[styles.semanaBtn, semana === s.n && styles.semanaBtnActive]}
                onPress={() => setSemana(s.n)}
                activeOpacity={0.7}
              >
                <Text style={[styles.semanaBtnText, semana === s.n && styles.semanaBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Ejercicios */}
          {ejercicios.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={32} color="#222" />
              <Text style={styles.emptyText}>Sin rutina asignada</Text>
            </View>
          ) : (
            ejercicios.map(ej => {
              const inp = inputs[ej.id] ?? {}
              return (
                <View key={ej.id} style={styles.ejCard}>
                  <Text style={styles.ejNombre}>{ej.nombre}</Text>

                  {/* Columnas planificado / realizado */}
                  <View style={styles.colsContainer}>
                    <View style={styles.col}>
                      <Text style={styles.colHeader}>PLANIFICADO</Text>
                      <Text style={styles.planVal}>
                        {ej.series != null ? `${ej.series} series` : '— series'}
                      </Text>
                      <Text style={styles.planVal}>
                        {ej.repeticiones ? `${ej.repeticiones} reps` : '— reps'}
                      </Text>
                      <Text style={styles.planVal}>— kg</Text>
                    </View>

                    <View style={styles.colDivider} />

                    <View style={styles.col}>
                      <Text style={styles.colHeader}>REALIZADO</Text>
                      <TextInput
                        style={styles.realInput}
                        value={inp.series}
                        onChangeText={v => updateInput(ej.id, 'series', v)}
                        placeholder="series"
                        placeholderTextColor="#2a2a2a"
                        keyboardType="numeric"
                      />
                      <TextInput
                        style={styles.realInput}
                        value={inp.reps}
                        onChangeText={v => updateInput(ej.id, 'reps', v)}
                        placeholder="reps"
                        placeholderTextColor="#2a2a2a"
                      />
                      <TextInput
                        style={styles.realInput}
                        value={inp.peso}
                        onChangeText={v => updateInput(ej.id, 'peso', v)}
                        placeholder="kg"
                        placeholderTextColor="#2a2a2a"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  {/* RPE */}
                  <View style={styles.rpeSection}>
                    <View style={styles.rpeLabelRow}>
                      <Text style={styles.metricLabel}>RPE</Text>
                      {inp.rpe != null && (
                        <Text style={styles.metricValue}>{inp.rpe}</Text>
                      )}
                    </View>
                    <View style={styles.numRow}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <TouchableOpacity
                          key={n}
                          style={[styles.numBtn, inp.rpe === n && styles.numBtnActive]}
                          onPress={() => updateInput(ej.id, 'rpe', inp.rpe === n ? null : n)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.numBtnText, inp.rpe === n && styles.numBtnTextActive]}>
                            {n}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* RIR */}
                  <View style={styles.rirRow}>
                    <Text style={styles.metricLabel}>RIR</Text>
                    <TextInput
                      style={styles.rirInput}
                      value={inp.rir}
                      onChangeText={v => updateInput(ej.id, 'rir', v)}
                      placeholder="0"
                      placeholderTextColor="#2a2a2a"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )
            })
          )}

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {ejercicios.length > 0 && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleGuardar}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                  <Text style={styles.saveBtnText}>Guardar entrenamiento</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal sensaciones ── */}
      <Modal visible={showSens} transparent animationType="slide">
        <View style={sensStyles.overlay}>
          <View style={sensStyles.sheet}>
            <View style={sensStyles.handle} />
            <ScrollView
              contentContainerStyle={sensStyles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={sensStyles.title}>¿Cómo te sentiste?</Text>

              {SENS_METRICS.map(({ key, label }) => (
                <View key={key} style={sensStyles.metricRow}>
                  <View style={sensStyles.metricTop}>
                    <Text style={sensStyles.metricLabel}>{label}</Text>
                    <Text style={sensStyles.metricVal}>{sens[key]}</Text>
                  </View>
                  <View style={sensStyles.numRow}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <TouchableOpacity
                        key={n}
                        style={[sensStyles.numBtn, sens[key] === n && sensStyles.numBtnActive]}
                        onPress={() => setSens(p => ({ ...p, [key]: n }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[sensStyles.numBtnText, sens[key] === n && sensStyles.numBtnTextActive]}>
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              <View style={sensStyles.metricRow}>
                <Text style={sensStyles.metricLabel}>Dolor / molestias</Text>
                <TextInput
                  style={sensStyles.textInput}
                  value={sens.dolor}
                  onChangeText={v => setSens(p => ({ ...p, dolor: v }))}
                  placeholder="Ninguna"
                  placeholderTextColor="#333"
                />
              </View>

              <View style={sensStyles.metricRow}>
                <Text style={sensStyles.metricLabel}>Comentarios</Text>
                <TextInput
                  style={[sensStyles.textInput, { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                  value={sens.comentarios}
                  onChangeText={v => setSens(p => ({ ...p, comentarios: v }))}
                  placeholder="Notas adicionales..."
                  placeholderTextColor="#333"
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[sensStyles.finBtn, savingSens && { opacity: 0.5 }]}
                onPress={handleFinalizar}
                disabled={savingSens}
                activeOpacity={0.8}
              >
                {savingSens ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={sensStyles.finBtnText}>Finalizar</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
      <Text style={styles.headerTitle}>Entrenar hoy</Text>
      <View style={styles.headerBtn} />
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
  scroll: { padding: 20, gap: 20, paddingBottom: 48 },

  fecha: { fontSize: 15, color: '#888', fontWeight: '500', textAlign: 'center' },

  semanaRow: { flexDirection: 'row', gap: 8 },
  semanaBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
  },
  semanaBtnActive:     { backgroundColor: '#fff', borderColor: '#fff' },
  semanaBtnText:       { color: '#444', fontSize: 12, fontWeight: '600' },
  semanaBtnTextActive: { color: '#000' },

  // Ejercicio card
  ejCard: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  ejNombre: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Columnas
  colsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    overflow: 'hidden',
  },
  col:       { flex: 1, padding: 12, gap: 6 },
  colDivider:{ width: 1, backgroundColor: '#1e1e1e' },
  colHeader: { fontSize: 10, color: '#444', fontWeight: '700', letterSpacing: 1, marginBottom: 2 },

  planVal: { color: '#555', fontSize: 14 },

  realInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },

  // RPE / RIR
  rpeSection:  { gap: 8 },
  rpeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricLabel: { fontSize: 12, color: '#555', fontWeight: '600', letterSpacing: 0.5 },
  metricValue: { fontSize: 14, color: '#fff', fontWeight: '700' },
  numRow:      { flexDirection: 'row', gap: 4 },
  numBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnActive:     { backgroundColor: '#fff', borderColor: '#fff' },
  numBtnText:       { color: '#444', fontSize: 12, fontWeight: '600' },
  numBtnTextActive: { color: '#000' },

  rirRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rirInput: {
    width: 64,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },

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

  saveBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDisabled:  { opacity: 0.5 },
  saveBtnText:  { color: '#000', fontSize: 16, fontWeight: '700' },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText:  { color: '#333', fontSize: 14 },
})

const sensStyles = StyleSheet.create({
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
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  title:  { fontSize: 18, color: '#fff', fontWeight: '700', marginBottom: 4 },

  metricRow: { gap: 8 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: 13, color: '#888' },
  metricVal:   { fontSize: 15, color: '#fff', fontWeight: '700' },

  numRow: { flexDirection: 'row', gap: 4 },
  numBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnActive:     { backgroundColor: '#fff', borderColor: '#fff' },
  numBtnText:       { color: '#444', fontSize: 12, fontWeight: '600' },
  numBtnTextActive: { color: '#000' },

  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },

  finBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  finBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})
