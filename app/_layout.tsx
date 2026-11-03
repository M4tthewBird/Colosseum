import { Cinzel_700Bold, useFonts } from '@expo-google-fonts/cinzel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CrashScreen } from '@/components/CrashScreen';
import { ConfirmHost, ToastHost } from '@/components/Overlays';
import { trackOpen } from '@/features/admin/events';
import { startAuth, useAuth } from '@/features/auth/auth';
import { setCurrentRoute, startErrorReports } from '@/features/feedback/report';
import { GymConfirmHost } from '@/features/gyms/GymConfirm';
import { SpotlightHost } from '@/features/onboarding/Spotlight';
import { Tour } from '@/features/onboarding/Tour';
import { WorkoutGuard } from '@/features/workout/WorkoutGuard';
import { startSync } from '@/lib/sync';
import { useData } from '@/stores/data';
import { colors } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

export { CrashScreen as ErrorBoundary };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });
  const hydrated = useData((s) => s.hydrated);
  const hasProfile = useData((s) => !!s.profile);
  const status = useAuth((s) => s.status);

  useEffect(() => {
    if (hydrated) startAuth();
  }, [hydrated]);
  useEffect(() => startSync(), []);
  useEffect(() => startErrorReports(), []);
  // Error reports say which screen it happened on.
  const pathname = usePathname();
  useEffect(() => setCurrentRoute(pathname), [pathname]);

  const ready = hydrated && status !== 'loading' && fontsLoaded;
  const signedIn = status === 'signedIn' && hasProfile;

  // Usage stats for the admin: opened today, and again when it comes back to the front.
  useEffect(() => {
    if (!signedIn) return;
    trackOpen();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') trackOpen();
    });
    return () => sub.remove();
  }, [signedIn]);

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
              <Stack.Screen name="generate" options={{ presentation: 'modal' }} />
              <Stack.Screen name="session/[id]" />
              <Stack.Screen name="user/[id]" />
              <Stack.Screen name="forum/index" />
              <Stack.Screen name="forum/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            {/* Friend and workout links (QR codes) open signed in or out. */}
            <Stack.Screen name="add/[username]" />
            <Stack.Screen name="together/[id]" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="dev/components" />
          </Stack>
        ) : (
          // Wait for the stored session so deep links and reloads keep their route.
          <View style={{ flex: 1, backgroundColor: colors.bg }} />
        )}
        {ready && signedIn ? <Tour /> : null}
        {ready && signedIn ? <SpotlightHost /> : null}
        {ready && signedIn ? <GymConfirmHost /> : null}
        {ready && signedIn ? <WorkoutGuard /> : null}
        <ToastHost />
        <ConfirmHost />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
