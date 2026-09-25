import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FadeUp, STAGGER_MS } from '@/components/fade-up';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { AppleSignInButton } from '@/features/auth/apple-sign-in-button';
import { AuthFormLayout } from '@/features/auth/auth-form-layout';
import { SignInSplash, SPLASH_MS } from '@/features/auth/sign-in-splash';
import { signInWithEmail } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { validateEmail } from '@/utils/validation';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Counters: each failed submit shakes the fields that failed.
  const [shake, setShake] = useState({ email: 0, password: 0 });
  const passwordRef = useRef<TextInput>(null);
  // The form rises in after the splash, or at once under Reduce Motion, which skips it.
  const start = useReducedMotion() ? 0 : SPLASH_MS;
  const at = (index: number) => start + index * STAGGER_MS;

  // On success the auth listener updates the session and the root guard navigates.
  const signIn = useMutation({
    mutationFn: () => signInWithEmail(email, password),
    onError: (e) => setFormError(friendlyError(e)),
  });

  const submit = () => {
    setSubmitted(true);
    setFormError(null);
    const badEmail = Boolean(validateEmail(email));
    if (badEmail || !password) {
      setShake((count) => ({ email: count.email + (badEmail ? 1 : 0), password: count.password + (password ? 0 : 1) }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    signIn.mutate();
  };

  return (
    <>
      <AuthFormLayout
        title="Welcome back"
        subtitle="Pick up where your thoughts left off."
        entrance={start}
        footer={
          <FadeUp delay={at(9)}>
            <Text variant="subhead" color="textSecondary" onPress={() => router.replace('/sign-up')} suppressHighlighting>
              New to Dicta? <Text variant="subhead" color="accent">Create an account</Text>
            </Text>
          </FadeUp>
        }>
        <AppleSignInButton mode="sign-in" onError={setFormError} entrance={at(3)} />
        <FadeUp delay={at(5)}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={submitted ? validateEmail(email) : null}
            shake={shake.email}
          />
        </FadeUp>
        <FadeUp delay={at(6)}>
          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={submitted && !password ? 'Enter your password.' : null}
            shake={shake.password}
          />
        </FadeUp>
        <FadeUp delay={at(7)}>
          <Text
            variant="subhead"
            color="textSecondary"
            style={styles.forgot}
            onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
            accessibilityRole="link"
            suppressHighlighting>
            Forgot password?
          </Text>
        </FadeUp>
        <FormError message={formError} />
        <FadeUp delay={at(8)}>
          <Button label="Sign in" onPress={submit} loading={signIn.isPending} />
        </FadeUp>
      </AuthFormLayout>
      <SignInSplash />
    </>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', paddingVertical: 4 },
});
