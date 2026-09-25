import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toaster } from '@/components/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { fontAssets } from '@/constants/fonts';
import { loadCardFonts } from '@/features/quote-card/fonts';
import { colors } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/use-my-profile';
import { usePushNotifications } from '@/hooks/use-push';
import { useSchemeName } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query-client';
import { friendlyError } from '@/services/errors';
import { startAuthListener, useAuth } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  useEffect(() => startAuthListener(), []);
  // Warm the card renderer's fonts so the first card paints without waiting.
  useEffect(() => {
    loadCardFonts().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator fontsReady={fontsLoaded || fontError !== null} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const scheme = useSchemeName();
  const theme = colors[scheme];
  const initialized = useAuth((s) => s.initialized);
  const signedIn = useAuth((s) => s.session !== null);
  const profile = useMyProfile();

  // Both flags only ever go false → true, so the navigator never unmounts once shown.
  // The profile is already cached by the time `signedIn` flips (see applySession).
  const ready = fontsReady && initialized;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  const hasProfile = Boolean(profile.data);
  usePushNotifications(ready && signedIn && hasProfile);

  if (!ready) return null;

  if (signedIn && profile.isError && !profile.data) {
    return (
      <Screen>
        <EmptyState
          title="Couldn’t load your profile"
          message={friendlyError(profile.error)}
          actionLabel="Try again"
          onAction={() => profile.refetch()}
        />
      </Screen>
    );
  }

  // Pushed screens use the native header: back chevron, title, no hairline.
  const pushed = {
    headerShown: true,
    title: '',
    headerBackButtonDisplayMode: 'minimal' as const,
    headerShadowVisible: false,
    headerTintColor: theme.text,
    headerStyle: { backgroundColor: theme.background },
  };
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: theme.background, card: theme.background, text: theme.text, primary: theme.accent, border: theme.hairline },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
          {/* The email-confirmation link. Signing in removes it, and the guards below
              take the person on: to profile setup when new, to the feed otherwise. */}
          <Stack.Screen name="auth-callback" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !hasProfile}>
          <Stack.Screen name="create-profile" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && hasProfile}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="create" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="post/[id]/index" options={pushed} />
          <Stack.Screen
            name="post/[id]/comments"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.62, 1],
              sheetGrabberVisible: true,
              sheetCornerRadius: 22,
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <Stack.Screen name="user/[username]" options={pushed} />
          <Stack.Screen name="topic/[slug]" options={pushed} />
          <Stack.Screen name="tag/[tag]" options={pushed} />
          <Stack.Screen name="settings/index" options={{ ...pushed, title: 'Settings' }} />
          <Stack.Screen name="settings/edit-profile" options={{ ...pushed, title: 'Edit profile' }} />
          <Stack.Screen name="settings/notifications" options={{ ...pushed, title: 'Notifications' }} />
          <Stack.Screen name="settings/blocked" options={{ ...pushed, title: 'Blocked accounts' }} />
          <Stack.Screen name="share" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* The password-reset link signs the person in, then asks for the new password. */}
        <Stack.Screen name="reset-password" />
      </Stack>
      <Toaster />
    </ThemeProvider>
  );
}
