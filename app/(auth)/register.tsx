import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function Register() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleRegister = async () => {
    if (!nombre.trim() || !email.trim() || !password) {
      setError('Completá todos los campos.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (signUpError) {
      setLoading(false)
      setError('No se pudo crear la cuenta. Intentá de nuevo.')
      return
    }

    if (!data.user) {
      setLoading(false)
      setError('No se pudo crear la cuenta. Intentá de nuevo.')
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      nombre: nombre.trim(),
      email: email.trim(),
      rol: 'alumno',
    })

    setLoading(false)

    if (profileError) {
      setError('Cuenta creada pero hubo un error al guardar el perfil.')
      return
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.subtitle}>Creá tu cuenta</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor="#555"
            autoCapitalize="words"
            value={nombre}
            onChangeText={setNombre}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#555"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña (mín. 6 caracteres)"
            placeholderTextColor="#555"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Registrarse</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.link}>
            ¿Ya tenés cuenta? <Text style={styles.linkBold}>Iniciá sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 28,
  },
  backText: {
    color: '#888',
    fontSize: 15,
  },
  logo: {
    width: 340,
    height: 170,
    marginBottom: 32,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
  },
  form: {
    gap: 14,
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: '#ff4757',
    fontSize: 14,
  },
  link: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
  },
  linkBold: {
    color: '#fff',
    fontWeight: '600',
  },
})
