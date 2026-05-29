import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
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

type EstadoVisual = 'pagado' | 'vencido' | 'por_vencer' | 'pendiente'
type MetodoPago = 'efectivo' | 'transferencia' | 'otro'

type Form = {
  alumnoId: string
  alumnoNombre: string
  planId: string
  planNombre: string
  fechaVencimiento: string
  monto: string
  metodoPago: MetodoPago
  estado: string
}

type AlumnoOption = { id: string; nombre: string }
type PlanOption = { id: string; nombre: string; precio: number | null }

const METODOS: { key: MetodoPago; label: string }[] = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'otro',          label: 'Otro' },
]

const ESTADOS = ['pendiente', 'pagado']

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

const ESTADO_CONFIG: Record<EstadoVisual, { color: string; label: string }> = {
  pagado:    { color: '#22c55e', label: 'PAGADO' },
  vencido:   { color: '#ef4444', label: 'VENCIDO' },
  por_vencer:{ color: '#f59e0b', label: 'POR VENCER' },
  pendiente: { color: '#888',    label: 'PENDIENTE' },
}

function formatDate(str: string | null): string {
  if (!str) return '—'
  return new Date(str + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function toDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function parseFecha(str: string): string | null {
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  const day = parseInt(d, 10)
  const month = parseInt(m, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function DetalleCuota() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()
  const [cuota, setCuota] = useState<Cuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({
    alumnoId: '', alumnoNombre: '', planId: '', planNombre: '',
    fechaVencimiento: '', monto: '', metodoPago: 'efectivo', estado: 'pendiente',
  })
  const [alumnos, setAlumnos] = useState<AlumnoOption[]>([])
  const [planes, setPlanes] = useState<PlanOption[]>([])
  const [showAlumnoModal, setShowAlumnoModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)

  useEffect(() => {
    if (!session || !id) return

    const load = async () => {
      const [{ data: cData, error: cErr }, { data: aData }, { data: pData }] = await Promise.all([
        supabase.rpc('get_cuota', { p_id: id }),
        supabase.rpc('get_mis_alumnos'),
        supabase.rpc('get_planes'),
      ])

      if (cErr || !cData || (cData as Cuota[]).length === 0) {
        setError('No se pudo cargar la cuota.')
        setLoading(false)
        return
      }

      const c = (cData as Cuota[])[0]
      setCuota(c)
      setForm({
        alumnoId:         c.alumno_id,
        alumnoNombre:     c.alumno_nombre,
        planId:           c.plan_id ?? '',
        planNombre:       c.plan_nombre ?? '',
        fechaVencimiento: toDisplayDate(c.fecha_vencimiento),
        monto:            String(c.monto),
        metodoPago:       (c.metodo_pago as MetodoPago) ?? 'efectivo',
        estado:           c.estado,
      })
      setAlumnos(((aData as any[]) ?? []).map(a => ({ id: a.id, nombre: a.nombre })))
      setPlanes((pData as PlanOption[]) ?? [])
      setLoading(false)
    }

    load()
  }, [id, session])

  const cancelEdit = () => {
    if (!cuota) return
    setForm({
      alumnoId:         cuota.alumno_id,
      alumnoNombre:     cuota.alumno_nombre,
      planId:           cuota.plan_id ?? '',
      planNombre:       cuota.plan_nombre ?? '',
      fechaVencimiento: toDisplayDate(cuota.fecha_vencimiento),
      monto:            String(cuota.monto),
      metodoPago:       (cuota.metodo_pago as MetodoPago) ?? 'efectivo',
      estado:           cuota.estado,
    })
    setError(null)
    setEditing(false)
  }

  const handleSave = async () => {
    if (!cuota) return
    const fechaISO = parseFecha(form.fechaVencimiento)
    if (!fechaISO) { setError('Fecha inválida. Usá el formato DD/MM/AAAA.'); return }
    if (!form.monto || isNaN(parseFloat(form.monto))) { setError('Monto inválido.'); return }

    setSaving(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('actualizar_cuota', {
        p_id:                cuota.id,
        p_alumno_id:         form.alumnoId,
        p_plan_id:           form.planId || null,
        p_fecha_vencimiento: fechaISO,
        p_monto:             parseFloat(form.monto),
        p_metodo_pago:       form.metodoPago,
        p_estado:            form.estado,
      })
      if (rpcErr) throw rpcErr

      setCuota(prev => prev ? {
        ...prev,
        alumno_id:         form.alumnoId,
        alumno_nombre:     form.alumnoNombre,
        plan_id:           form.planId || null,
        plan_nombre:       form.planNombre || null,
        fecha_vencimiento: fechaISO,
        monto:             parseFloat(form.monto),
        metodo_pago:       form.metodoPago,
        estado:            form.estado,
      } : prev)
      setEditing(false)
    } catch (e: any) {
      console.error('DetalleCuota save:', e)
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleMarcarPagado = async () => {
    if (!cuota) return
    setMarking(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('marcar_cuota_pagada', { p_id: cuota.id })
      if (rpcErr) throw rpcErr
      const hoy = new Date().toISOString().split('T')[0]
      setCuota(prev => prev ? { ...prev, estado: 'pagado', fecha_pago: hoy } : prev)
      setForm(prev => ({ ...prev, estado: 'pagado' }))
    } catch (e: any) {
      console.error('marcarPagado:', e)
      setError('No se pudo marcar como pagado.')
    } finally {
      setMarking(false)
    }
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

  if (!cuota) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Cuota no encontrada.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const ev = getEstadoVisual(cuota)
  const evCfg = ESTADO_CONFIG[ev]

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cuota</Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => editing ? cancelEdit() : setEditing(true)}
          >
            <Text style={styles.editBtnText}>{editing ? 'Cancelar' : 'Editar'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card principal de estado */}
          <View style={[styles.estadoCard, { borderColor: evCfg.color + '33' }]}>
            <Text style={[styles.estadoLabel, { color: evCfg.color }]}>{evCfg.label}</Text>
            <Text style={styles.montoGrande}>
              ${Number(cuota.monto).toLocaleString('es-AR')}
            </Text>
            <Text style={styles.alumnoNombre}>{cuota.alumno_nombre}</Text>
          </View>

          {editing ? (
            <>
              <Section title="ALUMNO">
                <TouchableOpacity style={styles.selector} onPress={() => setShowAlumnoModal(true)}>
                  <Text style={styles.selectorValue}>{form.alumnoNombre}</Text>
                  <Ionicons name="chevron-down" size={16} color="#555" />
                </TouchableOpacity>
              </Section>

              <Section title="PLAN (OPCIONAL)">
                <TouchableOpacity style={styles.selector} onPress={() => setShowPlanModal(true)}>
                  <Text style={form.planId ? styles.selectorValue : styles.selectorPlaceholder}>
                    {form.planNombre || 'Sin plan'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#555" />
                </TouchableOpacity>
              </Section>

              <Section title="MONTO Y VENCIMIENTO">
                <FieldInput
                  label="Monto"
                  value={form.monto}
                  onChangeText={v => setForm(p => ({ ...p, monto: v }))}
                  keyboardType="numeric"
                />
                <FieldInput
                  label="Fecha de vencimiento"
                  value={form.fechaVencimiento}
                  onChangeText={v => setForm(p => ({ ...p, fechaVencimiento: v }))}
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                />
              </Section>

              <Section title="MÉTODO DE PAGO">
                <View style={styles.metodoRow}>
                  {METODOS.map(m => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.metodoBtn, form.metodoPago === m.key && styles.metodoBtnActive]}
                      onPress={() => setForm(p => ({ ...p, metodoPago: m.key }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.metodoText, form.metodoPago === m.key && styles.metodoTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>

              <Section title="ESTADO">
                <View style={styles.metodoRow}>
                  {ESTADOS.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.metodoBtn, form.estado === s && styles.metodoBtnActive]}
                      onPress={() => setForm(p => ({ ...p, estado: s }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.metodoText, form.estado === s && styles.metodoTextActive]}>
                        {capitalize(s)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>
            </>
          ) : (
            <InfoSection title="DETALLE">
              <InfoRow label="Alumno"     value={cuota.alumno_nombre} />
              <InfoRow label="Plan"       value={cuota.plan_nombre ?? '—'} />
              <InfoRow label="Monto"      value={`$${Number(cuota.monto).toLocaleString('es-AR')}`} />
              <InfoRow label="Vencimiento" value={formatDate(cuota.fecha_vencimiento)} />
              <InfoRow label="Método"     value={capitalize(cuota.metodo_pago)} />
              <InfoRow label="Estado"     value={capitalize(cuota.estado)} />
              {cuota.fecha_pago && (
                <InfoRow label="Fecha pago" value={formatDate(cuota.fecha_pago)} last />
              )}
            </InfoSection>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {editing ? (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.saveBtnText}>Guardar cambios</Text>
              }
            </TouchableOpacity>
          ) : cuota.estado !== 'pagado' ? (
            <TouchableOpacity
              style={[styles.pagarBtn, marking && styles.btnDisabled]}
              onPress={handleMarcarPagado}
              disabled={marking}
              activeOpacity={0.8}
            >
              {marking ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#000" />
                  <Text style={styles.pagarBtnText}>Marcar como pagado</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal alumno */}
      <Modal visible={showAlumnoModal} transparent animationType="slide">
        <TouchableOpacity
          style={modalStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowAlumnoModal(false)}
        >
          <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>Seleccionar alumno</Text>
            <FlatList
              data={alumnos}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modalStyles.option}
                  onPress={() => {
                    setForm(p => ({ ...p, alumnoId: item.id, alumnoNombre: item.nombre }))
                    setShowAlumnoModal(false)
                  }}
                >
                  <Text style={modalStyles.optionText}>{item.nombre}</Text>
                  {form.alumnoId === item.id && (
                    <Ionicons name="checkmark" size={18} color="#22c55e" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal plan */}
      <Modal visible={showPlanModal} transparent animationType="slide">
        <TouchableOpacity
          style={modalStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowPlanModal(false)}
        >
          <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>Seleccionar plan</Text>
            <FlatList
              data={[{ id: '', nombre: 'Sin plan', precio: null }, ...planes]}
              keyExtractor={item => item.id || '__none__'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modalStyles.option}
                  onPress={() => {
                    setForm(p => ({ ...p, planId: item.id, planNombre: item.id ? item.nombre : '' }))
                    setShowPlanModal(false)
                  }}
                >
                  <View>
                    <Text style={modalStyles.optionText}>{item.nombre}</Text>
                    {item.precio != null && (
                      <Text style={modalStyles.optionSub}>${item.precio.toLocaleString('es-AR')}</Text>
                    )}
                  </View>
                  {form.planId === item.id && (
                    <Ionicons name="checkmark" size={18} color="#22c55e" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.content}>{children}</View>
    </View>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={infoStyles.box}>{children}</View>
    </View>
  )
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[infoStyles.row, last && infoStyles.rowLast]}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  )
}

function FieldInput({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: any
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#333"
        keyboardType={keyboardType}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  headerBtn: { width: 64, alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, color: '#fff', fontWeight: '600' },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  scroll: { padding: 20, gap: 24, paddingBottom: 48 },
  estadoCard: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  estadoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  montoGrande: { fontSize: 36, fontWeight: '800', color: '#fff' },
  alumnoNombre: { fontSize: 14, color: '#555' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectorValue: { color: '#fff', fontSize: 15 },
  selectorPlaceholder: { color: '#333', fontSize: 15 },
  metodoRow: { flexDirection: 'row', gap: 8 },
  metodoBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
  },
  metodoBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  metodoText: { color: '#555', fontSize: 13, fontWeight: '500' },
  metodoTextActive: { color: '#000' },
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
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  pagarBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pagarBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  backBtn: {
    borderWidth: 1, borderColor: '#222', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  backBtnText: { color: '#888', fontSize: 14 },
})

const sectionStyles = StyleSheet.create({
  container: { gap: 10 },
  title: { fontSize: 11, color: '#444', letterSpacing: 1.5, fontWeight: '600' },
  content: { gap: 10 },
})

const infoStyles = StyleSheet.create({
  box: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { width: 100, fontSize: 13, color: '#555', paddingTop: 2 },
  value: { flex: 1, fontSize: 14, color: '#fff' },
})

const fieldStyles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, color: '#888' },
  input: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
  },
})

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000bb',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  optionText: { color: '#fff', fontSize: 15 },
  optionSub: { color: '#555', fontSize: 13, marginTop: 2 },
})
