import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type AlumnoOption = { id: string; nombre: string }
type PlanOption = { id: string; nombre: string; precio: number | null }
type MetodoPago = 'efectivo' | 'transferencia' | 'otro'

type Form = {
  alumnoId: string
  alumnoNombre: string
  planId: string
  planNombre: string
  fechaVencimiento: string
  monto: string
  metodoPago: MetodoPago
}

const INITIAL_FORM: Form = {
  alumnoId: '',
  alumnoNombre: '',
  planId: '',
  planNombre: '',
  fechaVencimiento: '',
  monto: '',
  metodoPago: 'efectivo',
}

const METODOS: { key: MetodoPago; label: string }[] = [
  { key: 'efectivo',      label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'otro',          label: 'Otro' },
]

function parseFecha(str: string): string | null {
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  const day = parseInt(d, 10)
  const month = parseInt(m, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export default function NuevaCuota() {
  const router = useRouter()
  const { session } = useAuth()
  const [form, setForm] = useState<Form>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alumnos, setAlumnos] = useState<AlumnoOption[]>([])
  const [planes, setPlanes] = useState<PlanOption[]>([])
  const [showAlumnoModal, setShowAlumnoModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)

  useEffect(() => {
    if (!session) return
    Promise.all([
      supabase.rpc('get_mis_alumnos'),
      supabase.rpc('get_planes'),
    ]).then(([{ data: aData }, { data: pData }]) => {
      setAlumnos(((aData as any[]) ?? []).map(a => ({ id: a.id, nombre: a.nombre })))
      setPlanes((pData as PlanOption[]) ?? [])
    })
  }, [session])

  const handleGuardar = async () => {
    if (!form.alumnoId) { setError('Seleccioná un alumno.'); return }
    if (!form.fechaVencimiento) { setError('Ingresá la fecha de vencimiento.'); return }
    const fechaISO = parseFecha(form.fechaVencimiento)
    if (!fechaISO) { setError('Fecha inválida. Usá el formato DD/MM/AAAA.'); return }
    if (!form.monto || isNaN(parseFloat(form.monto))) { setError('Ingresá un monto válido.'); return }
    if (!session) return

    setLoading(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('crear_cuota', {
        p_alumno_id:         form.alumnoId,
        p_plan_id:           form.planId || null,
        p_fecha_vencimiento: fechaISO,
        p_monto:             parseFloat(form.monto),
        p_metodo_pago:       form.metodoPago,
      })
      if (rpcErr) throw rpcErr
      router.back()
    } catch (e: any) {
      console.error('NuevaCuota:', e)
      setError(e.message ?? 'Ocurrió un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

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
          <Text style={styles.headerTitle}>Nueva cuota</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section label="ALUMNO">
            <TouchableOpacity style={styles.selector} onPress={() => setShowAlumnoModal(true)}>
              <Text style={form.alumnoId ? styles.selectorValue : styles.selectorPlaceholder}>
                {form.alumnoNombre || 'Seleccionar alumno'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#555" />
            </TouchableOpacity>
          </Section>

          <Section label="PLAN (OPCIONAL)">
            <TouchableOpacity style={styles.selector} onPress={() => setShowPlanModal(true)}>
              <Text style={form.planId ? styles.selectorValue : styles.selectorPlaceholder}>
                {form.planNombre || 'Seleccionar plan'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#555" />
            </TouchableOpacity>
          </Section>

          <Section label="MONTO Y VENCIMIENTO">
            <Field
              label="Monto"
              value={form.monto}
              onChangeText={v => setForm(p => ({ ...p, monto: v }))}
              placeholder="Ej: 15000"
              keyboardType="numeric"
            />
            <Field
              label="Fecha de vencimiento"
              value={form.fechaVencimiento}
              onChangeText={v => setForm(p => ({ ...p, fechaVencimiento: v }))}
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
            />
          </Section>

          <Section label="MÉTODO DE PAGO">
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

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleGuardar}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveBtnText}>Registrar cuota</Text>
            }
          </TouchableOpacity>
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
              ListEmptyComponent={
                <Text style={modalStyles.emptyText}>No hay alumnos disponibles</Text>
              }
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
                    setForm(p => ({
                      ...p,
                      planId: item.id,
                      planNombre: item.id ? item.nombre : '',
                      monto: item.precio != null ? String(item.precio) : p.monto,
                    }))
                    setShowPlanModal(false)
                  }}
                >
                  <View>
                    <Text style={modalStyles.optionText}>{item.nombre}</Text>
                    {item.precio != null && (
                      <Text style={modalStyles.optionSub}>
                        ${item.precio.toLocaleString('es-AR')}
                      </Text>
                    )}
                  </View>
                  {form.planId === item.id && (
                    <Ionicons name="checkmark" size={18} color="#22c55e" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={modalStyles.emptyText}>No hay planes disponibles</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.label}>{label}</Text>
      <View style={sectionStyles.content}>{children}</View>
    </View>
  )
}

function Field({
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
  scroll: { padding: 20, gap: 24, paddingBottom: 48 },
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
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
})

const sectionStyles = StyleSheet.create({
  container: { gap: 12 },
  label: { fontSize: 11, color: '#444', letterSpacing: 1.5, fontWeight: '600' },
  content: { gap: 12 },
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
  emptyText: { color: '#555', textAlign: 'center', padding: 24, fontSize: 14 },
})
