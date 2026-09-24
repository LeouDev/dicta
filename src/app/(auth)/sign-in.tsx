import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { AppleSignInButton } from '@/features/auth/apple-sign-in-button';
import { AuthFormLayout } from '@/features/auth/auth-form-layout';
import { signInWithEmail } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { validateEmail } from '@/utils/validation';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  // On success the auth listener updates the session and the root guard navigates.
  const signIn = useMutation({
    mutationFn: () => signInWithEmail(email, password),
    onError: (e) => setFormError(friendlyError(e)),
  });

  const submit = () => {
    setSubmitted(true);
    setFormError(null);
    if (validateEmail(email) || !password) return;
    signIn.mutate();
  };

  return (
    <AuthFormLayout
      title="Welcome back"
      subtitle="Pick up where your thoughts left off."
      footer={
        <Text variant="subhead" color="textSecondary" onPress={() => router.replace('/sign-up')} suppressHighlighting>
          New to Dicta? <Text variant="subhead" color="accent">Create an account</Text>
        </Text>
      }>
      <AppleSignInButton mode="sign-in" onError={setFormError} />
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
      />
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
      />
      <Text
        variant="subhead"
        color="textSecondary"
        style={styles.forgot}
        onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
        accessibilityRole="link"
        suppressHighlighting>
        Forgot password?
      </Text>
      <FormError message={formError} />
      <Button label="Sign in" onPress={submit} loading={signIn.isPending} />
    </AuthFormLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', paddingVertical: 4 },
});
