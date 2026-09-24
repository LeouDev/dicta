import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { AuthFormLayout } from '@/features/auth/auth-form-layout';
import { CheckInbox } from '@/features/auth/check-inbox';
import { sendPasswordReset } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { validateEmail } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () => sendPasswordReset(email),
    onError: (e) => setFormError(friendlyError(e)),
  });

  const submit = () => {
    setSubmitted(true);
    setFormError(null);
    if (validateEmail(email)) return;
    reset.mutate();
  };

  if (reset.isSuccess) {
    return (
      <Screen>
        <CheckInbox
          email={email.trim()}
          message="Open this link on your iPhone to choose a new password. We sent it to"
          doneLabel="Back to sign in"
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <AuthFormLayout title="Reset password" subtitle="We’ll email you a link to choose a new one.">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        autoFocus
        onSubmitEditing={submit}
        error={submitted ? validateEmail(email) : null}
      />
      <FormError message={formError} />
      <Button label="Send reset link" onPress={submit} loading={reset.isPending} />
    </AuthFormLayout>
  );
}
