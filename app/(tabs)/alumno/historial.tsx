import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type RegistroEjercicio = {
  ejercicio_id: string
  ejercicio_nombre: string
  series_planificadas: number | null
  repeticiones_planificadas: string | null
  series_realizadas: number | null
  repeticiones_realizadas: string | null
  peso_realizado: number | null
  rpe: number | null
  rir: number | null
}

type RegistroEntreno = {
  fecha: string
  ejercicios: RegistroEjercicio[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEMANAS = [
  { n: 1, label: 'Sem. 1' },
  { n: 2, label: 'Sem. 2' },
  { n: 3, label: 'Sem. 3' },
  { n: 4, label: 'Descarga' },
]

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Historial() {
  const router = useRouter()
  const { session } = useAuth()

  const [semana, setSemana] = useState(1)
  const [registros, setRegistros] = useState<RegistroEntreno[]>([])
  const [alumnoId, setAlumnoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistorial = useCallback(async (sem: number) => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      let aid = alumnoId
      if (!aid) {
        const { data } = await supabase.rpc('get_mi_alumno_id')
        aid = data ?? null
        setAlumnoId(aid)
      }
      if (!aid) {
        setRegistros([])
        setLoading(false)
        return
      }
      const { data, error: err } = await supabase.rpc('get_resumen_semanal', {
        p_alumno_id: aid,
        p_semana: sem,
      })
      if (err) {
        setError('No se pudo cargar el historial.')
      } else {
        setRegistros((data as RegistroEntreno[]) ?? [])
      }
    } catch {
      setError('Error al cargar el historial.')
    } finally {
      setLoading(false)
    }
  }, [session, alumnoId])

  useFocusEffect(useCallback(() => {
    loadHistorial(semana)
  }, [semana]))

  const handleSemana = (s: number) => {
    setSemana(s)
    loadHistorial(s)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial de entrenos</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Selector semana */}
        <View style={styles.semanaRow}>
          {SEMANAS.map(s => (
            <TouchableOpacity
              key={s.n}
              style={[styles.semanaBtn, semana === s.n && styles.semanaBtnActive]}
              onPress={() => handleSemana(s.n)}
              activeOpacity={0.7}
            >
              <Text style={[styles.semanaBtnText, semana === s.n && styles.semanaBtnTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : registros.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color="#222" />
            <Text style={styles.emptyText}>Sin registros para esta semana</Text>
          </View>
        ) : (
          registros.map((reg, i) => (
            <View key={i} style={styles.regCard}>
              <View style={styles.regHeader}>
                <Ionicons name="calendar-outline" size={16} color="#888" />
                <Text style={styles.regFecha}>{formatFecha(reg.fecha)}</Text>
              </View>

              {/* Encabezados columnas */}
              <View style={styles.colRow}>
                <Text style={styles.ejCol}>Ejercicio</Text>
                <Text style={styles.numCol}>Plan</Text>
                <Text style={styles.numCol}>Real</Text>
                <Text style={styles.numCol}>Kg</Text>
                <Text style={styles.numCol}>RPE</Text>
              </View>

              {reg.ejercicios.map((ej, j) => (
                <View key={j} style={[styles.ejRow, j % 2 === 1 && styles.ejRowAlt]}>
                  <Text style={styles.ejName} numberOfLines={1}>{ej.ejercicio_nombre}</Text>
                  <Text style={styles.numCell}>
                    {ej.series_planificadas != null ? `${ej.series_planificadas}×${ej.repeticiones_planificadas ?? '?'}` : '—'}
                  </Text>
                  <Text style={styles.numCell}>
                    {ej.series_realizadas != null ? `${ej.series_realizadas}×${ej.repeticiones_realizadas ?? '?'}` : '—'}
                  </Text>
                  <Text style={styles.numCell}>
                    {ej.peso_realizado != null ? `${ej.peso_realizado}` : '—'}
                  </Text>
                  <Text style={[styles.numCell, ej.rpe != null && styles.rpeCell]}>
                    {ej.rpe ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { paddingVertical: 40, alignItems: 'center' },
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
  scroll: { padding: 20, gap: 16, paddingBottom: 48 },

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

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText:  { color: '#333', fontSize: 14 },

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

  regCard: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 14,
    overflow: 'hidden',
  },
  regHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  regFecha: { color: '#888', fontSize: 13, fontWeight: '600' },

  colRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  ejCol:   { flex: 2, fontSize: 10, color: '#444', fontWeight: '700', letterSpacing: 0.5 },
  numCol:  { flex: 1, fontSize: 10, color: '#444', fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },

  ejRow:     { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  ejRowAlt:  { backgroundColor: '#0a0a0a' },
  ejName:    { flex: 2, color: '#ccc', fontSize: 13 },
  numCell:   { flex: 1, color: '#888', fontSize: 12, textAlign: 'center' },
  rpeCell:   { color: '#fff', fontWeight: '700' },
})
