import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import * as Linking from 'expo-linking';
import { GameProvider } from '../context/GameContext';

// react-native-screens still uses core SafeAreaView internally;
// nothing actionable on our side until they migrate.
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

/**
 * iOS hands us a file:// URL when someone opens a .hardwoods file from
 * AirDrop, Messages, or Files. Route it to the import screen instead of
 * letting expo-router try to match it as a path.
 */
function useIncomingFiles() {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const open = (url: string | null) => {
      if (!url || !url.startsWith('file://') || handled.current === url) return;
      handled.current = url;
      router.push({ pathname: '/kidimport', params: { uri: url } });
    };

    Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener('url', e => open(e.url));
    return () => sub.remove();
  }, [router]);
}

export default function RootLayout() {
  useIncomingFiles();
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
