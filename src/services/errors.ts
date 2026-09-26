import { isSupabaseConfigured } from '@/lib/supabase';

/** Turns any thrown value into a sentence a person can act on. */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isSupabaseConfigured) {
    return 'Dicta isn’t connected to a server yet. Add your Supabase URL and key to .env.local.';
  }
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';

  if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
    return 'You seem to be offline. Check your connection and try again.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'That email and password don’t match.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Confirm your email first — check your inbox for the link.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (/objectionable_content/.test(message)) {
    return 'That includes a word Dicta doesn’t allow. Please edit it and try again.';
  }
  if (code === 'weak_password') return 'Choose a stronger password.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit/i.test(message)) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (code === '23505') return 'That’s already taken.';
  return fallback;
}
