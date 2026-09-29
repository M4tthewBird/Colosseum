import { Cinzel_700Bold, useFonts } from '@expo-google-fonts/cinzel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmHost, ToastHost } from '@/components/Overlays';
import { startAuth, useAuth } from '@/features/auth/auth';
import { startSync } from '@/lib/sync';
import { useData } from '@/stores/data';
import { colors } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const hydrated = useData((s) => s.hydrated);
  const hasProfile = useData((s) => !!s.profile);
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (hydrated) startAuth();
  }, [hydrated]);
  useEffect(() => startSync(), []);

  const ready = hydrated && status !== 'loading' && fontsLoaded;
  const signedIn = status === 'signedIn' && hasProfile;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {ready ? (
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
          >
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="workout/[id]"
                options={{
                  presentation: 'fullScreenModal',
                  animation: 'slide_from_bottom',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen name="program/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="session/[id]" />
              <Stack.Screen name="user/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Screen name="dev/components" />
          </Stack>
        ) : (
          // Wait for the stored session so deep links and reloads keep their route.
          <View style={{ flex: 1, backgroundColor: colors.bg }} />
        )}
        <ToastHost />
        <ConfirmHost />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
