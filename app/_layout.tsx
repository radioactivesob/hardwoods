import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { GameProvider } from '../context/GameContext';

// react-native-screens still uses core SafeAreaView internally;
// nothing actionable on our side until they migrate.
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

export default function RootLayout() {
  return (
    <GameProvider>
      <StatusBar style="light" hidden />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#1A0F00' },
          animation: 'slide_from_right',
        }}
      />
    </GameProvider>
  );
}
