import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

import { unregisterDevice } from './push';

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Returns true when the project requires email confirmation before sign-in. */
export async function signUpWithEmail(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: Linking.createURL('/auth-callback') },
  });
  if (error) throw error;
  // With email confirmation on, Supabase answers an address that already has an
  // account with a stand-in user (no identities) and sends no email.
  if (data.user?.identities?.length === 0) {
    throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
  }
  return { needsConfirmation: !data.session };
}

export async function isAppleSignInAvailable() {
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Native Sign in with Apple → Supabase ID-token sign-in. Returns false if the
 * person cancelled. Apple only shares the name on first authorization, so it's
 * stashed in user metadata to prefill profile setup.
 */
export async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple didn’t return an identity token.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } });
  return true;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('/reset-password'),
  });
  if (error) throw error;
}

/** Exchanges the PKCE `code` from an email link for a session. */
export async function exchangeAuthCode(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  // Stop pushes to this phone first: removing its token needs the session.
  await unregisterDevice().catch(() => {});
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
