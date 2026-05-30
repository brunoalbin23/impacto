import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'

type Solicitud = {
  id: string
  nombre: string
  email: string
  created_at: string
}

function formatFecha(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function SolicitudesScreen() {
  const router = useRouter()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('get_solicitudes_pendientes')
    setLoading(false)
    if (rpcError) {
      setError('No se pudieron cargar las solicitudes.')
      return
    }
    setSolicitudes(data ?? [])
  }, [])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar])
  )

  const aprobar = (solicitud: Solicitud) => {
    Alert.alert(
      'Aprobar solicitud',
      `¿Aprobás el ingreso de ${solicitud.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: async () => {
            setProcesando(solicitud.id)
            const { error: rpcError } = await supabase.rpc('aprobar_alumno', {
              p_profile_id: solicitud.id,
            })
            setProcesando(null)
            if (rpcError) {
              Alert.alert('Error al aprobar', rpcError.message)
              return
            }
            setSolicitudes((prev) => prev.filter((s) => s.id !== solicitud.id))
          },
        },
      ]
    )
  }

  const rechazar = (solicitud: Solicitud) => {
    Alert.alert(
      'Rechazar solicitud',
      `¿Rechazás la solicitud de ${solicitud.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setProcesando(solicitud.id)
            const { error: rpcError } = await supabase.rpc('rechazar_alumno', {
              p_profile_id: solicitud.id,
            })
            setProcesando(null)
            if (rpcError) {
              Alert.alert('Error', 'No se pudo rechazar la solicitud.')
              return
            }
            setSolicitudes((prev) => prev.filter((s) => s.id !== solicitud.id))
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitudes</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={cargar} style={styles.retryButton}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={solicitudes.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={cargar}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>No hay solicitudes pendientes</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isProcesando = procesando === item.id
            return (
              <View style={styles.card}>
                <View style={styles.cardInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={styles.cardTexts}>
                    <Text style={styles.cardNombre}>{item.nombre}</Text>
                    <Text style={styles.cardEmail}>{item.email}</Text>
                    <Text style={styles.cardFecha}>Solicitó el {formatFecha(item.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  {isProcesando ? (
                    <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.btnAprobar}
                        onPress={() => aprobar(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.btnAprobarText}>Aprobar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnRechazar}
                        onPress={() => rechazar(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.btnRechazarText}>Rechazar</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  backButton: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  headerSpacer: {
    width: 36,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    color: '#444',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardTexts: {
    flex: 1,
    gap: 2,
  },
  cardNombre: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cardEmail: {
    color: '#555',
    fontSize: 13,
  },
  cardFecha: {
    color: '#444',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAprobar: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnAprobarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnRechazar: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnRechazarText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
})
