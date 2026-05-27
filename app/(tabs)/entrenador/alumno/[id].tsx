import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type Alumno = {
  id: string
  profile_id: string
  objetivo: string | null
  estado_fisico: string | null
  observaciones: string | null
  fecha_inicio: string | null
  estado: string
  nombre: string
  email: string
  telefono: string | null
}

type Form = {
  nombre: string
  email: string
  telefono: string
  objetivo: string
  estadoFisico: string
  observaciones: string
  estado: string
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function AlumnoPerfil() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()
  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({
    nombre: '', email: '', telefono: '',
    objetivo: '', estadoFisico: '', observaciones: '', estado: 'activo',
  })

  useEffect(() => {
    if (!session || !id) return
    const fetch = async () => {
      const { data, error: err } = await supabase
        .rpc('get_alumno', { p_id: id })

      if (err) { setError('No se pudo cargar el alumno.'); setLoading(false); return }
      const rows = data as Alumno[]
      if (!rows || rows.length === 0) { setError('Alumno no encontrado.'); setLoading(false); return }
      const a = rows[0]
      setAlumno(a)
      setForm({
        nombre: a.nombre ?? '',
        email: a.email ?? '',
        telefono: a.telefono ?? '',
        objetivo: a.objetivo ?? '',
        estadoFisico: a.estado_fisico ?? '',
        observaciones: a.observaciones ?? '',
        estado: a.estado ?? 'activo',
      })
      setLoading(false)
    }
    fetch()
  }, [id, session])

  const set = (field: keyof Form) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!alumno || !form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('actualizar_alumno', {
        p_id:            alumno.id,
        p_nombre:        form.nombre.trim(),
        p_email:         form.email.trim() || null,
        p_telefono:      form.telefono.trim() || null,
        p_objetivo:      form.objetivo.trim() || null,
        p_estado_fisico: form.estadoFisico.trim() || null,
        p_observaciones: form.observaciones.trim() || null,
        p_estado:        form.estado,
      })

      if (rpcErr) throw rpcErr

      setAlumno((prev) =>
        prev
          ? {
              ...prev,
              nombre: form.nombre,
              email: form.email,
              telefono: form.telefono || null,
              objetivo: form.objetivo || null,
              estado_fisico: form.estadoFisico || null,
              observaciones: form.observaciones || null,
              estado: form.estado,
            }
          : prev
      )
      setEditing(false)
    } catch (e: any) {
      console.error('AlumnoPerfil save:', e)
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    if (!alumno) return
    setForm({
      nombre: alumno.nombre ?? '',
      email: alumno.email ?? '',
      telefono: alumno.telefono ?? '',
      objetivo: alumno.objetivo ?? '',
      estadoFisico: alumno.estado_fisico ?? '',
      observaciones: alumno.observaciones ?? '',
      estado: alumno.estado ?? 'activo',
    })
    setError(null)
    setEditing(false)
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

  if (!alumno) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Alumno no encontrado.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const nombre = alumno.nombre ?? 'Sin nombre'

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
          <Text style={styles.headerTitle} numberOfLines={1}>{nombre}</Text>
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
          {/* Estado badge */}
          <View style={styles.estadoRow}>
            {editing ? (
              <TouchableOpacity
                style={[styles.estadoToggle, form.estado === 'activo' ? styles.estadoActivo : styles.estadoInactivo]}
                onPress={() => set('estado')(form.estado === 'activo' ? 'inactivo' : 'activo')}
              >
                <View style={[styles.estadoDot, { backgroundColor: form.estado === 'activo' ? '#22c55e' : '#555' }]} />
                <Text style={[styles.estadoLabel, { color: form.estado === 'activo' ? '#22c55e' : '#555' }]}>
                  {form.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </Text>
                <Ionicons name="swap-horizontal" size={14} color="#555" />
              </TouchableOpacity>
            ) : (
              <View style={styles.estadoBadge}>
                <View style={[styles.estadoDot, { backgroundColor: alumno.estado === 'activo' ? '#22c55e' : '#555' }]} />
                <Text style={[styles.estadoLabel, { color: alumno.estado === 'activo' ? '#22c55e' : '#555' }]}>
                  {alumno.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            )}
            {!editing && (
              <Text style={styles.fechaText}>
                Desde {formatDate(alumno.fecha_inicio)}
              </Text>
            )}
          </View>

          <InfoSection title="INFORMACIÓN PERSONAL">
            <InfoRow label="Nombre" value={editing ? undefined : alumno.nombre ?? '—'} editing={editing}
              inputValue={form.nombre} onChangeText={set('nombre')} autoCapitalize="words" />
            <InfoRow label="Email" value={editing ? undefined : alumno.email ?? '—'} editing={editing}
              inputValue={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
            <InfoRow label="Teléfono" value={editing ? undefined : alumno.telefono ?? '—'} editing={editing}
              inputValue={form.telefono} onChangeText={set('telefono')} keyboardType="phone-pad" />
          </InfoSection>

          <InfoSection title="PLAN DE ENTRENAMIENTO">
            <InfoRow label="Objetivo" value={editing ? undefined : alumno.objetivo ?? '—'} editing={editing}
              inputValue={form.objetivo} onChangeText={set('objetivo')} multiline />
            <InfoRow label="Estado físico" value={editing ? undefined : alumno.estado_fisico ?? '—'} editing={editing}
              inputValue={form.estadoFisico} onChangeText={set('estadoFisico')} />
          </InfoSection>

          <InfoSection title="OBSERVACIONES">
            <InfoRow label="Notas" value={editing ? undefined : alumno.observaciones ?? '—'} editing={editing}
              inputValue={form.observaciones} onChangeText={set('observaciones')} multiline />
          </InfoSection>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {editing && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar cambios</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.box}>{children}</View>
    </View>
  )
}

function InfoRow({
  label, value, editing, inputValue, onChangeText,
  multiline, keyboardType, autoCapitalize,
}: {
  label: string
  value?: string
  editing: boolean
  inputValue?: string
  onChangeText?: (v: string) => void
  multiline?: boolean
  keyboardType?: any
  autoCapitalize?: any
}) {
  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={[rowStyles.input, multiline && rowStyles.inputMultiline]}
          value={inputValue}
          onChangeText={onChangeText}
          placeholderTextColor="#333"
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      ) : (
        <Text style={rowStyles.value}>{value}</Text>
      )}
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
  estadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  estadoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  estadoActivo: { borderColor: '#22c55e22', backgroundColor: '#22c55e11' },
  estadoInactivo: { borderColor: '#33333388' },
  estadoDot: { width: 7, height: 7, borderRadius: 4 },
  estadoLabel: { fontSize: 13, fontWeight: '500' },
  fechaText: { fontSize: 12, color: '#444' },
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
  backBtn: {
    borderWidth: 1, borderColor: '#222', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  backBtnText: { color: '#888', fontSize: 14 },
})

const sectionStyles = StyleSheet.create({
  container: { gap: 10 },
  title: { fontSize: 11, color: '#444', letterSpacing: 1.5, fontWeight: '600' },
  box: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    overflow: 'hidden',
  },
})

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  label: { width: 100, fontSize: 13, color: '#555', paddingTop: 2 },
  value: { flex: 1, fontSize: 14, color: '#fff' },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 2,
  },
  inputMultiline: { minHeight: 60 },
})
