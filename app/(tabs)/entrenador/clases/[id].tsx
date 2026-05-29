import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type Form = {
  nombre: string
  descripcion: string
  capacidadMax: string
  diasSemana: string[]
  horaInicio: string
  horaFin: string
}

const INITIAL_FORM: Form = {
  nombre: '',
  descripcion: '',
  capacidadMax: '',
  diasSemana: [],
  horaInicio: '',
  horaFin: '',
}

const DIAS = [
  { key: 'lun', label: 'LUN' },
  { key: 'mar', label: 'MAR' },
  { key: 'mie', label: 'MIÉ' },
  { key: 'jue', label: 'JUE' },
  { key: 'vie', label: 'VIE' },
  { key: 'sab', label: 'SÁB' },
  { key: 'dom', label: 'DOM' },
]

function parseDias(raw: string[] | string | null): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw.replace(/^{|}$/g, '').split(',').filter(Boolean)
}

function parseTime(str: string): string | null {
  const s = str.trim()
  if (!s) return null
  const match = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function toDisplayTime(t: string | null): string {
  if (!t) return ''
  return t.substring(0, 5)
}

export default function ClaseForm() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()
  const isNuevo = id === 'nuevo'

  const [form, setForm] = useState<Form>(INITIAL_FORM)
  const [loading, setLoading] = useState(!isNuevo)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNuevo || !session || !id) return

    const load = async () => {
      const { data, error: err } = await supabase.rpc('get_clase', { p_id: id })
      if (err || !data || (data as any[]).length === 0) {
        setError('No se pudo cargar la clase.')
        setLoading(false)
        return
      }
      const c = (data as any[])[0]
      setForm({
        nombre:       c.nombre ?? '',
        descripcion:  c.descripcion ?? '',
        capacidadMax: c.capacidad_max != null ? String(c.capacidad_max) : '',
        diasSemana:   parseDias(c.dias_semana),
        horaInicio:   toDisplayTime(c.hora_inicio),
        horaFin:      toDisplayTime(c.hora_fin),
      })
      setLoading(false)
    }

    load()
  }, [id, isNuevo, session])

  const toggleDia = (dia: string) => {
    setForm(prev => ({
      ...prev,
      diasSemana: prev.diasSemana.includes(dia)
        ? prev.diasSemana.filter(d => d !== dia)
        : [...prev.diasSemana, dia],
    }))
  }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!session) return

    const horaInicio = form.horaInicio.trim() ? parseTime(form.horaInicio) : null
    const horaFin    = form.horaFin.trim()    ? parseTime(form.horaFin)    : null

    if (form.horaInicio.trim() && !horaInicio) {
      setError('Hora de inicio inválida. Usá el formato HH:MM.')
      return
    }
    if (form.horaFin.trim() && !horaFin) {
      setError('Hora de fin inválida. Usá el formato HH:MM.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const params = {
        p_nombre:        form.nombre.trim(),
        p_descripcion:   form.descripcion.trim() || null,
        p_capacidad_max: form.capacidadMax ? parseInt(form.capacidadMax, 10) : null,
        p_dias_semana:   form.diasSemana,
        p_hora_inicio:   horaInicio,
        p_hora_fin:      horaFin,
      }

      if (isNuevo) {
        const { error: rpcErr } = await supabase.rpc('crear_clase', params)
        if (rpcErr) throw rpcErr
      } else {
        const { error: rpcErr } = await supabase.rpc('actualizar_clase', { p_id: id, ...params })
        if (rpcErr) throw rpcErr
      }

      router.back()
    } catch (e: any) {
      console.error('ClaseForm save:', e)
      setError(e.message ?? 'Ocurrió un error. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = () => {
    Alert.alert(
      'Eliminar clase',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              const { error: rpcErr } = await supabase.rpc('eliminar_clase', { p_id: id })
              if (rpcErr) throw rpcErr
              router.back()
            } catch (e: any) {
              console.error('eliminarClase:', e)
              setError('No se pudo eliminar la clase.')
              setDeleting(false)
            }
          },
        },
      ]
    )
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

  if (error && !isNuevo && !form.nombre) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTextLone}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
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
          <Text style={styles.headerTitle}>{isNuevo ? 'Nueva clase' : 'Editar clase'}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section label="INFORMACIÓN">
            <Field
              label="Nombre *"
              value={form.nombre}
              onChangeText={v => setForm(p => ({ ...p, nombre: v }))}
              placeholder="Ej: Funcional, Musculación, Yoga..."
              autoCapitalize="sentences"
            />
            <Field
              label="Descripción"
              value={form.descripcion}
              onChangeText={v => setForm(p => ({ ...p, descripcion: v }))}
              placeholder="Descripción opcional..."
              multiline
            />
            <Field
              label="Capacidad máxima"
              value={form.capacidadMax}
              onChangeText={v => setForm(p => ({ ...p, capacidadMax: v }))}
              placeholder="Ej: 10"
              keyboardType="numeric"
            />
          </Section>

          <Section label="DÍAS DE LA SEMANA">
            <View style={styles.diasRow}>
              {DIAS.map(d => {
                const activo = form.diasSemana.includes(d.key)
                return (
                  <TouchableOpacity
                    key={d.key}
                    style={[styles.diaPill, activo && styles.diaPillActive]}
                    onPress={() => toggleDia(d.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.diaText, activo && styles.diaTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Section>

          <Section label="HORARIO">
            <View style={styles.horaRow}>
              <View style={styles.horaField}>
                <Field
                  label="Hora inicio"
                  value={form.horaInicio}
                  onChangeText={v => setForm(p => ({ ...p, horaInicio: v }))}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.horaSep}>
                <Text style={styles.horaSepText}>—</Text>
              </View>
              <View style={styles.horaField}>
                <Field
                  label="Hora fin"
                  value={form.horaFin}
                  onChangeText={v => setForm(p => ({ ...p, horaFin: v }))}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </Section>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleGuardar}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveBtnText}>{isNuevo ? 'Crear clase' : 'Guardar cambios'}</Text>
            }
          </TouchableOpacity>

          {!isNuevo ? (
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && styles.btnDisabled]}
              onPress={handleEliminar}
              disabled={deleting}
              activeOpacity={0.8}
            >
              {deleting ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={styles.deleteBtnText}>Eliminar clase</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  label, value, onChangeText, placeholder,
  multiline, keyboardType, autoCapitalize,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  multiline?: boolean
  keyboardType?: any
  autoCapitalize?: any
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#333"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? 'top' : 'center'}
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
  headerBtn: { width: 36 },
  headerTitle: { fontSize: 17, color: '#fff', fontWeight: '600' },
  scroll: { padding: 20, gap: 24, paddingBottom: 48 },
  diasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  diaPill: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0f0f0f',
  },
  diaPillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  diaText: { fontSize: 12, color: '#444', fontWeight: '700' },
  diaTextActive: { color: '#000' },
  horaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  horaField: { flex: 1 },
  horaSep: { paddingBottom: 13 },
  horaSepText: { color: '#333', fontSize: 18 },
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
  errorTextLone: { color: '#ef4444', fontSize: 14 },
  saveBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#2a1010',
    backgroundColor: '#150808',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  backBtn: {
    borderWidth: 1, borderColor: '#222', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  backBtnText: { color: '#888', fontSize: 14 },
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
  inputMultiline: { minHeight: 80, paddingTop: 12 },
})
