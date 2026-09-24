import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { useSchemeName, useTheme } from '@/hooks/use-theme';
import { isAppleSignInAvailable, signInWithApple } from '@/services/auth';
import { friendlyError } from '@/services/errors';

interface AppleSignInButtonProps {
  mode: 'sign-in' | 'sign-up';
  onError: (message: string) => void;
}

/** Native Sign in with Apple button followed by an "or" divider. Renders nothing where unavailable. */
export function AppleSignInButton({ mode, onError }: AppleSignInButtonProps) {
  const scheme = useSchemeName();
  const theme = useTheme();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAvailable, () => setAvailable(false));
  }, []);

  if (!available) return null;

  return (
    <View style={styles.wrap}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          mode === 'sign-up'
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={
          scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={radius.pill}
        style={[styles.button, busy && styles.busy]}
        onPress={async () => {
          if (busy) return;
          setBusy(true);
          try {
            await signInWithApple();
          } catch (e) {
            onError(friendlyError(e, 'Sign in with Apple didn’t work. Please try again.'));
          } finally {
            setBusy(false);
          }
        }}
      />
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: theme.hairline }]} />
        <Text variant="caption" color="textTertiary">
          or use email
        </Text>
        <View style={[styles.line, { backgroundColor: theme.hairline }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  // Apple scales its label with height; 50pt keeps it close to our 17pt buttons.
  button: { height: 50, width: '100%' },
  busy: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
