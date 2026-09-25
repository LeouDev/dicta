import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { AuthFormLayout } from '@/features/auth/auth-form-layout';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useTheme } from '@/hooks/use-theme';
import { exchangeAuthCode, updatePassword } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { useAuth } from '@/store/auth';
import { PASSWORD_MIN, validatePassword } from '@/utils/validation';

const EXPIRED = 'This reset link is invalid or has expired. Request a new one from the sign-in screen.';

/** Target of the password-reset email (dicta://reset-password?code=…). */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [phase, setPhase] = useState<'verifying' | 'form' | 'invalid'>(code && !error_description ? 'verifying' : 'invalid');
  const [linkError, setLinkError] = useState(error_description ?? EXPIRED);
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const started = useRef(false);
  const signedIn = useAuth((st) => st.session !== null);
  const hasProfile = Boolean(useMyProfile().data);
  // This screen sits outside the root layout's guards, so it goes on to a route that's
  // open in the current state (a guarded one would leave the person stuck here).
  const next = () => router.replace(!signedIn ? '/sign-in' : hasProfile ? '/' : '/create-profile');

  useEffect(() => {
    if (phase !== 'verifying' || !code || started.current) return;
    started.current = true;
    exchangeAuthCode(code).then(
      () => setPhase('form'),
      (e) => {
        setLinkError(friendlyError(e, EXPIRED));
        setPhase('invalid');
      },
    );
  }, [code, phase]);

  const update = useMutation({
    mutationFn: () => updatePassword(password),
    onSuccess: next,
    onError: (e) => setFormError(friendlyError(e)),
  });

  if (phase === 'verifying') {
    return (
      <Screen contentStyle={styles.center}>
        <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Checking your reset link" />
      </Screen>
    );
  }

  if (phase === 'invalid') {
    return (
      <Screen>
        <EmptyState title="Link expired" message={linkError} actionLabel="Continue" onAction={next} />
      </Screen>
    );
  }

  const submit = () => {
    setSubmitted(true);
    setFormError(null);
    if (validatePassword(password)) return;
    update.mutate();
  };

  return (
    <AuthFormLayout title="Choose a new password" subtitle="You’ll use it the next time you sign in.">
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${PASSWORD_MIN} characters`}
        secureTextEntry
        autoFocus
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules={`minlength: ${PASSWORD_MIN};`}
        returnKeyType="done"
        onSubmitEditing={submit}
        error={submitted ? validatePassword(password) : null}
      />
      <FormError message={formError} />
      <Button label="Update password" onPress={submit} loading={update.isPending} />
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
});
