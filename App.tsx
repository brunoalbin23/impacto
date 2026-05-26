import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { supabase } from './lib/supabase'

export default function App() {
  const [estado, setEstado] = useState('Conectando...')

  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        setEstado('✗ Error: ' + error.message)
      } else {
        setEstado('✓ Supabase conectado')
      }
    })
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18 }}>{estado}</Text>
    </View>
  )
}