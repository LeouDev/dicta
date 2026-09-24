// Mirrors the CHECK constraints in supabase/migrations — keep them in sync.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 160;
export const PASSWORD_MIN = 8;

const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lowercases and strips anything a username can't contain (including a leading @). */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, USERNAME_MAX);
}

export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (!USERNAME_PATTERN.test(username)) return 'Use letters, numbers, periods and underscores.';
  if (/^[._]|[._]$/.test(username)) return "Can't start or end with a period or underscore.";
  if (username.includes('..')) return "Can't contain two periods in a row.";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email.';
  return EMAIL_PATTERN.test(email.trim()) ? null : 'That email doesn’t look right.';
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  return null;
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Add the name people will see.';
  if (trimmed.length > DISPLAY_NAME_MAX) return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  return null;
}

/** Suggests a username from a display name or email, e.g. "Leou Dev" → "leoudev". */
export function suggestUsername(source: string): string {
  const base = source.split('@')[0] ?? '';
  return normalizeUsername(base.replace(/[\s-]+/g, '')).replace(/^[._]+|[._]+$/g, '');
}
