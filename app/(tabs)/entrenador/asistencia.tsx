import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

export default function Asistencia() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Asistencia</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.body}>
        <Ionicons name="checkmark-circle-outline" size={56} color="#222" />
        <Text style={styles.comingSoon}>Próximamente</Text>
        <Text style={styles.description}>Acá vas a poder registrar la asistencia de tus alumnos.</Text>
      </View>
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
  backButton: { width: 36 },
  headerTitle: { fontSize: 17, color: '#fff', fontWeight: '600' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  comingSoon: { fontSize: 20, color: '#fff', fontWeight: '700' },
  description: { fontSize: 14, color: '#444', textAlign: 'center', paddingHorizontal: 40 },
})
