import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'

export default function DashboardAlumno() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Panel</Text>
        <Text style={styles.title}>Alumno</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.placeholder}>Próximamente: tus clases, asistencias y plan de entrenamiento.</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  label: {
    fontSize: 13,
    color: '#555',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#444',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
})
