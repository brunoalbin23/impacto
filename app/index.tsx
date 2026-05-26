import { ActivityIndicator, View } from 'react-native'

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  )
}
