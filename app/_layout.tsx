import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GameProvider } from '../context/GameContext';

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
