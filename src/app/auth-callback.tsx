import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { useTheme } from '@/hooks/use-theme';
import { exchangeAuthCode } from '@/services/auth';
import { friendlyError } from '@/services/errors';

const EXPIRED = 'This link is invalid or has expired. You can request a new one from the sign-in screen.';

/** Target of the email-confirmation link (dicta://auth-callback?code=…), shown only while signed out. */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(error_description ?? (code ? null : EXPIRED));
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true; // codes are single-use
    // On success the session arrives and the root layout's guards move on from this screen.
    exchangeAuthCode(code).catch((e) => setError(friendlyError(e, EXPIRED)));
  }, [code]);

  return (
    <Screen contentStyle={styles.center}>
      {error ? (
        <EmptyState title="Link expired" message={error} actionLabel="Sign in" onAction={() => router.replace('/sign-in')} />
      ) : (
        <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Confirming your email" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
});
