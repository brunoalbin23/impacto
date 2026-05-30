import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'] as const
const NIVEL_COLOR: Record<string, string> = {
  Principiante: '#16a34a',
  Intermedio:   '#f59e0b',
  Avanzado:     '#ef4444',
}

export default function NuevaRutina() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [nivel, setNivel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCrear = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true)
    setError(null)
    const { data, error: rpcErr } = await supabase.rpc('crear_rutina', {
      p_nombre:      nombre.trim(),
      p_descripcion: descripcion.trim() || null,
      p_nivel:       nivel,
    })
    setSaving(false)
    if (rpcErr) { setError(rpcErr.message); return }
    router.replace(`/(tabs)/entrenador/rutinas/${data}` as any)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva rutina</Text>
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
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Full body, Tren superior..."
            />
            <Field
              label="Descripción"
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Descripción opcional..."
              multiline
            />
          </Section>

          <Section label="NIVEL">
            <View style={styles.nivelesRow}>
              {NIVELES.map((n) => {
                const activo = nivel === n
                return (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.nivelBtn,
                      activo && { borderColor: NIVEL_COLOR[n], backgroundColor: NIVEL_COLOR[n] + '22' },
                    ]}
                    onPress={() => setNivel(activo ? null : n)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.nivelBtnText, activo && { color: NIVEL_COLOR[n] }]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                )
              })}
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
            onPress={handleCrear}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveBtnText}>Crear rutina</Text>
            }
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
  label, value, onChangeText, placeholder, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; multiline?: boolean
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
        autoCapitalize="sentences"
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
  nivelesRow: { flexDirection: 'row', gap: 8 },
  nivelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
  },
  nivelBtnText: { color: '#444', fontSize: 13, fontWeight: '600' },
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
  btnDisabled: { opacity: 0.5 },
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
