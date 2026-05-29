import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, FlatList, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type ClaseOption = { id: string; nombre: string }

type AlumnoAsistencia = {
  alumno_id: string
  nombre: string
  estado: 'presente' | 'ausente'
  tiene_registro: boolean
}

function formatFechaHoy(): string {
  const d = new Date()
  const weekday = d.toLocaleDateString('es-AR', { weekday: 'long' })
  const day = d.getDate()
  const month = d.toLocaleDateString('es-AR', { month: 'long' })
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return `${cap(weekday)} ${day} de ${cap(month)}`
}

export default function Asistencia() {
  const router = useRouter()
  const { session } = useAuth()

  const [clases, setClases] = useState<ClaseOption[]>([])
  const [loadingClases, setLoadingClases] = useState(true)
  const [claseId, setClaseId] = useState('')
  const [claseNombre, setClaseNombre] = useState('')
  const [alumnos, setAlumnos] = useState<AlumnoAsistencia[]>([])
  const [loadingAlumnos, setLoadingAlumnos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showClaseModal, setShowClaseModal] = useState(false)

  const fetchClases = useCallback(async () => {
    if (!session) return
    try {
      const { data, error: err } = await supabase.rpc('get_mis_clases')
      if (err) throw err
      setClases((data as ClaseOption[]) ?? [])
    } catch (e: any) {
      console.error('fetchClases asistencia:', e)
    } finally {
      setLoadingClases(false)
    }
  }, [session])

  useFocusEffect(
    useCallback(() => {
      setLoadingClases(true)
      setClaseId('')
      setClaseNombre('')
      setAlumnos([])
      setSaved(false)
      setError(null)
      fetchClases()
    }, [fetchClases])
  )

  const selectClase = async (id: string, nombre: string) => {
    setClaseId(id)
    setClaseNombre(nombre)
    setShowClaseModal(false)
    setSaved(false)
    setError(null)
    setLoadingAlumnos(true)
    try {
      const { data, error: err } = await supabase.rpc('get_asistencia_hoy', { p_clase_id: id })
      if (err) throw err
      setAlumnos((data as AlumnoAsistencia[]) ?? [])
    } catch (e: any) {
      console.error('get_asistencia_hoy:', e)
      setError('No se pudo cargar la asistencia.')
    } finally {
      setLoadingAlumnos(false)
    }
  }

  const toggleAlumno = (alumnoId: string) => {
    setAlumnos(prev =>
      prev.map(a =>
        a.alumno_id === alumnoId
          ? { ...a, estado: a.estado === 'presente' ? 'ausente' : 'presente' }
          : a
      )
    )
    setSaved(false)
  }

  const handleGuardar = async () => {
    if (!claseId || !session) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const { error: rpcErr } = await supabase.rpc('guardar_asistencia', {
        p_clase_id:  claseId,
        p_registros: alumnos.map(a => ({ alumno_id: a.alumno_id, estado: a.estado })),
      })
      if (rpcErr) throw rpcErr
      setSaved(true)
      // Marcar todos como tiene_registro=true
      setAlumnos(prev => prev.map(a => ({ ...a, tiene_registro: true })))
    } catch (e: any) {
      console.error('guardar_asistencia:', e)
      setError('No se pudo guardar la asistencia.')
    } finally {
      setSaving(false)
    }
  }

  const presentes = alumnos.filter(a => a.estado === 'presente').length
  const yaGuardado = alumnos.some(a => a.tiene_registro)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Asistencia</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Fecha */}
        <Text style={styles.fecha}>{formatFechaHoy()}</Text>

        {/* Selector clase */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CLASE</Text>
          {loadingClases ? (
            <View style={styles.selectorSkeleton}>
              <ActivityIndicator size="small" color="#555" />
            </View>
          ) : clases.length === 0 ? (
            <View style={styles.emptyClases}>
              <Ionicons name="barbell-outline" size={32} color="#222" />
              <Text style={styles.emptyClasesText}>
                Primero creá clases desde el módulo Clases.
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.selector} onPress={() => setShowClaseModal(true)}>
              <Text style={claseId ? styles.selectorValue : styles.selectorPlaceholder}>
                {claseNombre || 'Seleccionar clase'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {/* Contenido: alumnos */}
        {claseId ? (
          <View style={styles.section}>
            {loadingAlumnos ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : alumnos.length === 0 ? (
              <View style={styles.emptyAlumnos}>
                <Ionicons name="people-outline" size={36} color="#222" />
                <Text style={styles.emptyText}>No hay alumnos activos para registrar.</Text>
              </View>
            ) : (
              <>
                {/* Indicador ya guardado */}
                {yaGuardado && !saved ? (
                  <View style={styles.editandoBox}>
                    <Ionicons name="create-outline" size={14} color="#f59e0b" />
                    <Text style={styles.editandoText}>Editando asistencia ya guardada hoy</Text>
                  </View>
                ) : null}

                {/* Resumen */}
                <View style={styles.resumen}>
                  <View style={styles.resumenItem}>
                    <View style={[styles.resumenDot, { backgroundColor: '#22c55e' }]} />
                    <Text style={styles.resumenText}>{presentes} presentes</Text>
                  </View>
                  <View style={styles.resumenSep} />
                  <View style={styles.resumenItem}>
                    <View style={[styles.resumenDot, { backgroundColor: '#333' }]} />
                    <Text style={styles.resumenText}>{alumnos.length - presentes} ausentes</Text>
                  </View>
                </View>

                {/* Lista alumnos */}
                <View style={styles.alumnosList}>
                  {alumnos.map((a, index) => (
                    <TouchableOpacity
                      key={a.alumno_id}
                      style={[
                        styles.alumnoRow,
                        index === alumnos.length - 1 && styles.alumnoRowLast,
                      ]}
                      onPress={() => toggleAlumno(a.alumno_id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.alumnoNombre}>{a.nombre}</Text>
                      <View style={[
                        styles.estadoBadge,
                        a.estado === 'presente' ? styles.estadoPresente : styles.estadoAusente,
                      ]}>
                        <Text style={[
                          styles.estadoText,
                          { color: a.estado === 'presente' ? '#22c55e' : '#555' },
                        ]}>
                          {a.estado === 'presente' ? 'Presente' : 'Ausente'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Error */}
                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Success */}
                {saved ? (
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                    <Text style={styles.successText}>Asistencia guardada correctamente.</Text>
                  </View>
                ) : null}

                {/* Guardar */}
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleGuardar}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.saveBtnText}>Guardar asistencia</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Modal clase */}
      <Modal visible={showClaseModal} transparent animationType="slide">
        <TouchableOpacity
          style={modalStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowClaseModal(false)}
        >
          <View style={modalStyles.sheet}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>Seleccionar clase</Text>
            <FlatList
              data={clases}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modalStyles.option}
                  onPress={() => selectClase(item.id, item.nombre)}
                >
                  <Text style={modalStyles.optionText}>{item.nombre}</Text>
                  {claseId === item.id && (
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
  scroll: { padding: 20, gap: 20, paddingBottom: 48 },
  fecha: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
  },
  section: { gap: 12 },
  sectionLabel: { fontSize: 11, color: '#444', letterSpacing: 1.5, fontWeight: '600' },
  selectorSkeleton: {
    height: 50,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyClases: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    padding: 24,
  },
  emptyClasesText: { color: '#444', fontSize: 14, textAlign: 'center' },
  loadingBox: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAlumnos: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  emptyText: { color: '#444', fontSize: 14, textAlign: 'center' },
  editandoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1400',
    borderWidth: 1,
    borderColor: '#f59e0b28',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editandoText: { color: '#f59e0b', fontSize: 13 },
  resumen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  resumenItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resumenDot: { width: 8, height: 8, borderRadius: 4 },
  resumenText: { color: '#555', fontSize: 14 },
  resumenSep: { width: 1, height: 14, backgroundColor: '#1e1e1e' },
  alumnosList: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  alumnoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  alumnoRowLast: { borderBottomWidth: 0 },
  alumnoNombre: { color: '#fff', fontSize: 15, flex: 1, marginRight: 12 },
  estadoBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  estadoPresente: { backgroundColor: '#22c55e18' },
  estadoAusente: { backgroundColor: '#1e1e1e' },
  estadoText: { fontSize: 13, fontWeight: '600' },
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
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0a1a0a',
    borderWidth: 1,
    borderColor: '#22c55e28',
    borderRadius: 8,
    padding: 12,
  },
  successText: { color: '#22c55e', fontSize: 14 },
  saveBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
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
    maxHeight: '60%',
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
})
