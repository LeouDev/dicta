import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { AppleSignInButton } from '@/features/auth/apple-sign-in-button';
import { AuthFormLayout } from '@/features/auth/auth-form-layout';
import { CheckInbox } from '@/features/auth/check-inbox';
import { signUpWithEmail } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { PASSWORD_MIN, validateEmail, validatePassword } from '@/utils/validation';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const signUp = useMutation({
    mutationFn: () => signUpWithEmail(email, password),
    // With a session, the root guard moves on to profile setup by itself.
    onSuccess: ({ needsConfirmation }) => needsConfirmation && setSentTo(email.trim()),
    onError: (e) => setFormError(friendlyError(e)),
  });

  const submit = () => {
    setSubmitted(true);
    setFormError(null);
    if (validateEmail(email) || validatePassword(password)) return;
    signUp.mutate();
  };

  if (sentTo) {
    return (
      <Screen>
        <CheckInbox
          email={sentTo}
          message="Tap the confirmation link we sent to"
          doneLabel="Back to sign in"
          onDone={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <AuthFormLayout
      title="Create your account"
      subtitle="A place where your thoughts become art."
      footer={
        <Text variant="subhead" color="textSecondary" onPress={() => router.replace('/sign-in')} suppressHighlighting>
          Already have an account? <Text variant="subhead" color="accent">Sign in</Text>
        </Text>
      }>
      <AppleSignInButton mode="sign-up" onError={setFormError} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={submitted ? validateEmail(email) : null}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${PASSWORD_MIN} characters`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules={`minlength: ${PASSWORD_MIN};`}
        returnKeyType="go"
        onSubmitEditing={submit}
        error={submitted ? validatePassword(password) : null}
      />
      <FormError message={formError} />
      <Button label="Continue" onPress={submit} loading={signUp.isPending} />
    </AuthFormLayout>
  );
}
