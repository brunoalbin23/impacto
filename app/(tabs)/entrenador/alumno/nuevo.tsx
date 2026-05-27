import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type Form = {
  nombre: string
  email: string
  telefono: string
  objetivo: string
  estadoFisico: string
  observaciones: string
}

const INITIAL_FORM: Form = {
  nombre: '',
  email: '',
  telefono: '',
  objetivo: '',
  estadoFisico: '',
  observaciones: '',
}

export default function NuevoAlumno() {
  const router = useRouter()
  const { session } = useAuth()
  const [form, setForm] = useState<Form>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof Form) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!session) return

    setLoading(true)
    setError(null)

    try {
      const { error: rpcErr } = await supabase.rpc('crear_alumno', {
        p_nombre:         form.nombre.trim(),
        p_email:          form.email.trim() || null,
        p_telefono:       form.telefono.trim() || null,
        p_objetivo:       form.objetivo.trim() || null,
        p_estado_fisico:  form.estadoFisico.trim() || null,
        p_observaciones:  form.observaciones.trim() || null,
      })

      if (rpcErr) throw new Error(rpcErr.message)

      router.back()
    } catch (e: any) {
      console.error('NuevoAlumno:', e)
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
          <Text style={styles.headerTitle}>Nuevo alumno</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section label="INFORMACIÓN PERSONAL">
            <Field
              label="Nombre completo *"
              value={form.nombre}
              onChangeText={set('nombre')}
              placeholder="Ej: Juan García"
              autoCapitalize="words"
            />
            <Field
              label="Email"
              value={form.email}
              onChangeText={set('email')}
              placeholder="Ej: juan@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Teléfono"
              value={form.telefono}
              onChangeText={set('telefono')}
              placeholder="Ej: +54 11 1234-5678"
              keyboardType="phone-pad"
            />
          </Section>

          <Section label="PLAN DE ENTRENAMIENTO">
            <Field
              label="Objetivo"
              value={form.objetivo}
              onChangeText={set('objetivo')}
              placeholder="Ej: Ganar masa muscular, bajar de peso..."
              multiline
            />
            <Field
              label="Estado físico actual"
              value={form.estadoFisico}
              onChangeText={set('estadoFisico')}
              placeholder="Ej: Sedentario, activo, deportista..."
            />
          </Section>

          <Section label="OBSERVACIONES">
            <Field
              label="Notas adicionales"
              value={form.observaciones}
              onChangeText={set('observaciones')}
              placeholder="Lesiones, consideraciones especiales..."
              multiline
            />
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
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar alumno</Text>
            )}
          </TouchableOpacity>
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
  inputMultiline: { minHeight: 80, paddingTop: 12 },
})
