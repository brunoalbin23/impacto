import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Modal, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
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

type RutinaDetalle = {
  id: string
  nombre: string
  descripcion: string | null
  nivel: string | null
  created_at: string
  ejercicios: Ejercicio[]
}

type AlumnoAsignado = {
  alumno_id: string
  nombre: string
  email: string
}

type AlumnoOption = {
  id: string
  nombre: string
  email: string
}

const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'] as const

const NIVEL_COLOR: Record<string, string> = {
  Principiante: '#16a34a',
  Intermedio:   '#f59e0b',
  Avanzado:     '#ef4444',
}

const EJ_EMPTY = { nombre: '', series: '', repeticiones: '', notas: '' }

// ─── Component ────────────────────────────────────────────────────────────────

export default function RutinaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [rutina, setRutina] = useState<RutinaDetalle | null>(null)
  const [alumnosAsignados, setAlumnosAsignados] = useState<AlumnoAsignado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // — Edit rutina
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', nivel: '' })
  const [saving, setSaving] = useState(false)

  // — Modal ejercicio (add / edit)
  const [modalEj, setModalEj] = useState(false)
  const [ejEditando, setEjEditando] = useState<Ejercicio | null>(null)
  const [formEj, setFormEj] = useState(EJ_EMPTY)
  const [savingEj, setSavingEj] = useState(false)

  // — Modal asignar alumno
  const [modalAsignar, setModalAsignar] = useState(false)
  const [misAlumnos, setMisAlumnos] = useState<AlumnoOption[]>([])
  const [loadingAlumnos, setLoadingAlumnos] = useState(false)

  // ─── Load ─────────────────────────────────────────────────────────────────

  const loadRutina = useCallback(async () => {
    if (!id) return
    const [rutinaRes, alumnosRes] = await Promise.all([
      supabase.rpc('get_rutina', { p_id: id }),
      supabase.rpc('get_alumnos_rutina', { p_rutina_id: id }),
    ])
    setLoading(false)
    if (rutinaRes.error || !rutinaRes.data || (rutinaRes.data as any[]).length === 0) {
      setError('No se pudo cargar la rutina.')
      return
    }
    const r = (rutinaRes.data as any[])[0]
    setRutina({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      nivel: r.nivel,
      created_at: r.created_at,
      ejercicios: Array.isArray(r.ejercicios) ? r.ejercicios : [],
    })
    setAlumnosAsignados((alumnosRes.data as AlumnoAsignado[]) ?? [])
  }, [id])

  useEffect(() => {
    loadRutina()
  }, [loadRutina])

  // ─── Edit rutina ──────────────────────────────────────────────────────────

  const startEdit = () => {
    if (!rutina) return
    setEditForm({ nombre: rutina.nombre, descripcion: rutina.descripcion ?? '', nivel: rutina.nivel ?? '' })
    setEditMode(true)
  }

  const cancelEdit = () => setEditMode(false)

  const handleGuardar = async () => {
    if (!editForm.nombre.trim()) { Alert.alert('', 'El nombre es obligatorio.'); return }
    setSaving(true)
    const { error: rpcErr } = await supabase.rpc('actualizar_rutina', {
      p_id:          id,
      p_nombre:      editForm.nombre.trim(),
      p_descripcion: editForm.descripcion.trim() || null,
      p_nivel:       editForm.nivel || null,
    })
    setSaving(false)
    if (rpcErr) { Alert.alert('Error', rpcErr.message); return }
    setRutina(prev => prev ? {
      ...prev,
      nombre:      editForm.nombre.trim(),
      descripcion: editForm.descripcion.trim() || null,
      nivel:       editForm.nivel || null,
    } : prev)
    setEditMode(false)
  }

  // ─── Eliminar rutina ──────────────────────────────────────────────────────

  const handleEliminar = () => {
    Alert.alert(
      'Eliminar rutina',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const { error: rpcErr } = await supabase.rpc('eliminar_rutina', { p_id: id })
            if (rpcErr) { Alert.alert('Error', rpcErr.message); return }
            router.back()
          },
        },
      ]
    )
  }

  // ─── Ejercicios ───────────────────────────────────────────────────────────

  const openNuevoEj = () => {
    setEjEditando(null)
    setFormEj(EJ_EMPTY)
    setModalEj(true)
  }

  const openEditarEj = (ej: Ejercicio) => {
    setEjEditando(ej)
    setFormEj({
      nombre:       ej.nombre,
      series:       ej.series != null ? String(ej.series) : '',
      repeticiones: ej.repeticiones ?? '',
      notas:        ej.notas ?? '',
    })
    setModalEj(true)
  }

  const handleGuardarEj = async () => {
    if (!formEj.nombre.trim()) { Alert.alert('', 'El nombre del ejercicio es obligatorio.'); return }
    setSavingEj(true)

    const params = {
      p_nombre:       formEj.nombre.trim(),
      p_series:       formEj.series ? parseInt(formEj.series, 10) : null,
      p_repeticiones: formEj.repeticiones.trim() || null,
      p_notas:        formEj.notas.trim() || null,
      p_orden:        ejEditando ? ejEditando.orden : (rutina?.ejercicios.length ?? 0),
    }

    let rpcErr
    if (ejEditando) {
      ;({ error: rpcErr } = await supabase.rpc('actualizar_ejercicio', { p_id: ejEditando.id, ...params }))
    } else {
      ;({ error: rpcErr } = await supabase.rpc('agregar_ejercicio', { p_rutina_id: id, ...params }))
    }

    setSavingEj(false)
    if (rpcErr) { Alert.alert('Error', rpcErr.message); return }
    setModalEj(false)
    // Reload to get updated exercise list with IDs
    await loadRutina()
  }

  const handleEliminarEj = (ej: Ejercicio) => {
    Alert.alert(
      'Eliminar ejercicio',
      `¿Eliminás "${ej.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const { error: rpcErr } = await supabase.rpc('eliminar_ejercicio', { p_id: ej.id })
            if (rpcErr) { Alert.alert('Error', rpcErr.message); return }
            setRutina(prev => prev ? { ...prev, ejercicios: prev.ejercicios.filter(e => e.id !== ej.id) } : prev)
          },
        },
      ]
    )
  }

  // ─── Asignar alumno ───────────────────────────────────────────────────────

  const openAsignar = async () => {
    setModalAsignar(true)
    setLoadingAlumnos(true)
    const { data } = await supabase.rpc('get_mis_alumnos')
    const asignadosIds = new Set(alumnosAsignados.map(a => a.alumno_id))
    const disponibles = ((data as any[]) ?? [])
      .filter((a: any) => !asignadosIds.has(a.id))
      .map((a: any) => ({ id: a.id, nombre: a.nombre, email: a.email }))
    setMisAlumnos(disponibles)
    setLoadingAlumnos(false)
  }

  const handleAsignar = async (alumno: AlumnoOption) => {
    const { error: rpcErr } = await supabase.rpc('asignar_rutina', {
      p_rutina_id: id,
      p_alumno_id: alumno.id,
    })
    if (rpcErr) { Alert.alert('Error', rpcErr.message); return }
    setAlumnosAsignados(prev => [...prev, { alumno_id: alumno.id, nombre: alumno.nombre, email: alumno.email }])
    setMisAlumnos(prev => prev.filter(a => a.id !== alumno.id))
  }

  const handleDesasignar = (alumno: AlumnoAsignado) => {
    Alert.alert(
      'Desasignar',
      `¿Desasignás esta rutina a ${alumno.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desasignar', style: 'destructive',
          onPress: async () => {
            const { error: rpcErr } = await supabase.rpc('desasignar_rutina', {
              p_rutina_id: id,
              p_alumno_id: alumno.alumno_id,
            })
            if (rpcErr) { Alert.alert('Error', rpcErr.message); return }
            setAlumnosAsignados(prev => prev.filter(a => a.alumno_id !== alumno.alumno_id))
          },
        },
      ]
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View>
      </SafeAreaView>
    )
  }

  if (error || !rutina) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rutina</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'No encontrada'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{rutina.nombre}</Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={editMode ? cancelEdit : startEdit}
          >
            <Ionicons name={editMode ? 'close' : 'pencil-outline'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Info rutina ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INFORMACIÓN</Text>
            {editMode ? (
              <View style={{ gap: 12 }}>
                <TextInput
                  style={styles.input}
                  value={editForm.nombre}
                  onChangeText={v => setEditForm(p => ({ ...p, nombre: v }))}
                  placeholder="Nombre *"
                  placeholderTextColor="#333"
                  autoCapitalize="sentences"
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={editForm.descripcion}
                  onChangeText={v => setEditForm(p => ({ ...p, descripcion: v }))}
                  placeholder="Descripción..."
                  placeholderTextColor="#333"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                />
                <View style={styles.nivelesRow}>
                  {NIVELES.map(n => {
                    const activo = editForm.nivel === n
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[styles.nivelBtn, activo && { borderColor: NIVEL_COLOR[n], backgroundColor: NIVEL_COLOR[n] + '22' }]}
                        onPress={() => setEditForm(p => ({ ...p, nivel: activo ? '' : n }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.nivelBtnText, activo && { color: NIVEL_COLOR[n] }]}>{n}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }]} onPress={cancelEdit}>
                    <Text style={styles.btnSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { flex: 1 }, saving && styles.btnDisabled]}
                    onPress={handleGuardar}
                    disabled={saving}
                  >
                    {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nombre</Text>
                  <Text style={styles.infoValue}>{rutina.nombre}</Text>
                </View>
                {rutina.nivel ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nivel</Text>
                    <View style={[styles.nivelBadge, { borderColor: NIVEL_COLOR[rutina.nivel] ?? '#555' }]}>
                      <Text style={[styles.nivelBadgeText, { color: NIVEL_COLOR[rutina.nivel] ?? '#555' }]}>
                        {rutina.nivel}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {rutina.descripcion ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Descripción</Text>
                    <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]}>{rutina.descripcion}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* ── Ejercicios ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>EJERCICIOS ({rutina.ejercicios.length})</Text>
              <TouchableOpacity onPress={openNuevoEj} style={styles.addBtn}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            {rutina.ejercicios.length === 0 ? (
              <Text style={styles.emptyHint}>No hay ejercicios. Agregá el primero.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {rutina.ejercicios.map((ej) => (
                  <View key={ej.id} style={styles.ejCard}>
                    <TouchableOpacity
                      style={styles.ejInfo}
                      onPress={() => openEditarEj(ej)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.ejNombre}>{ej.nombre}</Text>
                      <Text style={styles.ejDetalle}>
                        {[
                          ej.series != null ? `${ej.series} series` : null,
                          ej.repeticiones ? `${ej.repeticiones} reps` : null,
                        ].filter(Boolean).join(' × ') || '—'}
                      </Text>
                      {ej.notas ? <Text style={styles.ejNotas} numberOfLines={1}>{ej.notas}</Text> : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleEliminarEj(ej)}
                      style={styles.ejDeleteBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color="#555" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Alumnos asignados ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ALUMNOS ASIGNADOS</Text>
            </View>

            {alumnosAsignados.length === 0 ? (
              <Text style={styles.emptyHint}>Ningún alumno asignado aún.</Text>
            ) : (
              <View style={styles.chipsRow}>
                {alumnosAsignados.map((a) => (
                  <View key={a.alumno_id} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>{a.nombre}</Text>
                    <TouchableOpacity onPress={() => handleDesasignar(a)} style={styles.chipClose}>
                      <Ionicons name="close" size={13} color="#888" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.btnSecondary} onPress={openAsignar} activeOpacity={0.7}>
              <Ionicons name="person-add-outline" size={15} color="#fff" />
              <Text style={styles.btnSecondaryText}>Asignar a alumno</Text>
            </TouchableOpacity>
          </View>

          {/* ── Eliminar ── */}
          <TouchableOpacity style={styles.deleteBtn} onPress={handleEliminar} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.deleteBtnText}>Eliminar rutina</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal ejercicio ── */}
      <Modal visible={modalEj} transparent animationType="slide" onRequestClose={() => setModalEj(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.sheetHeader}>
              <Text style={modal.sheetTitle}>{ejEditando ? 'Editar ejercicio' : 'Nuevo ejercicio'}</Text>
              <TouchableOpacity onPress={() => setModalEj(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12, paddingBottom: 24 }}>
                <ModalField label="Nombre *" value={formEj.nombre} onChangeText={v => setFormEj(p => ({ ...p, nombre: v }))} placeholder="Ej: Sentadilla, Press banca..." />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <ModalField label="Series" value={formEj.series} onChangeText={v => setFormEj(p => ({ ...p, series: v }))} placeholder="Ej: 4" keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ModalField label="Repeticiones" value={formEj.repeticiones} onChangeText={v => setFormEj(p => ({ ...p, repeticiones: v }))} placeholder="Ej: 10-12" />
                  </View>
                </View>
                <ModalField label="Notas" value={formEj.notas} onChangeText={v => setFormEj(p => ({ ...p, notas: v }))} placeholder="Descanso, carga, técnica..." multiline />
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[modal.saveBtn, savingEj && styles.btnDisabled]}
              onPress={handleGuardarEj}
              disabled={savingEj}
            >
              {savingEj ? <ActivityIndicator color="#000" /> : <Text style={modal.saveBtnText}>Guardar ejercicio</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal asignar alumno ── */}
      <Modal visible={modalAsignar} transparent animationType="slide" onRequestClose={() => setModalAsignar(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.sheetHeader}>
              <Text style={modal.sheetTitle}>Asignar a alumno</Text>
              <TouchableOpacity onPress={() => setModalAsignar(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingAlumnos ? (
              <View style={styles.center}><ActivityIndicator color="#fff" /></View>
            ) : misAlumnos.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                <Ionicons name="checkmark-circle-outline" size={40} color="#333" />
                <Text style={{ color: '#555', fontSize: 14 }}>Todos los alumnos ya tienen esta rutina</Text>
              </View>
            ) : (
              <FlatList
                data={misAlumnos}
                keyExtractor={item => item.id}
                style={{ maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={modal.alumnoRow}
                    onPress={() => handleAsignar(item)}
                    activeOpacity={0.7}
                  >
                    <View style={modal.alumnoAvatar}>
                      <Text style={modal.alumnoAvatarText}>{item.nombre?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={modal.alumnoNombre}>{item.nombre}</Text>
                      <Text style={modal.alumnoEmail}>{item.email}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color="#16a34a" />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#111' }} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function ModalField({
  label, value, onChangeText, placeholder, multiline, keyboardType,
}: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; multiline?: boolean; keyboardType?: any
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: '#888', fontSize: 13 }}>{label}</Text>
      <TextInput
        style={[modal.input, multiline && modal.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#333"
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize="sentences"
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, color: '#fff', fontWeight: '600' },
  scroll: { padding: 20, gap: 28, paddingBottom: 48 },

  section: { gap: 14 },
  sectionLabel: { fontSize: 11, color: '#444', letterSpacing: 1.5, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  infoCard: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  infoLabel: { color: '#555', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '500' },

  nivelBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  nivelBadgeText: { fontSize: 11, fontWeight: '600' },

  nivelesRow: { flexDirection: 'row', gap: 8 },
  nivelBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#1e1e1e',
    backgroundColor: '#0f0f0f', alignItems: 'center',
  },
  nivelBtnText: { color: '#444', fontSize: 12, fontWeight: '600' },

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
  inputMultiline: { minHeight: 72, paddingTop: 12 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#222', borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  addBtnText: { color: '#fff', fontSize: 13 },

  ejCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 12,
    gap: 8,
  },
  ejInfo: { flex: 1, gap: 2 },
  ejNombre: { color: '#fff', fontSize: 14, fontWeight: '600' },
  ejDetalle: { color: '#555', fontSize: 13 },
  ejNotas: { color: '#444', fontSize: 12 },
  ejDeleteBtn: { padding: 6 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 180,
  },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  chipClose: { padding: 2 },

  emptyHint: { color: '#444', fontSize: 13 },

  btnPrimary: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { color: '#000', fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#222', borderRadius: 10,
    paddingVertical: 13,
  },
  btnSecondaryText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#2a1010',
    backgroundColor: '#150808',
    borderRadius: 12, paddingVertical: 14,
  },
  deleteBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  errorText: { color: '#ef4444', fontSize: 14 },
  retryBtn: {
    borderWidth: 1, borderColor: '#222', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20,
  },
  retryText: { color: '#888', fontSize: 14 },
})

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#fff',
  },
  inputMultiline: { minHeight: 72, paddingTop: 12 },
  saveBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  alumnoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  alumnoAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#222', alignItems: 'center', justifyContent: 'center',
  },
  alumnoAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  alumnoNombre: { color: '#fff', fontSize: 14, fontWeight: '600' },
  alumnoEmail: { color: '#555', fontSize: 12 },
})
