import { signUpWithEmail } from '../auth';
import { friendlyError } from '../errors';

const mockSignUp = jest.fn();
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { signUp: (...args: unknown[]) => mockSignUp(...args) } },
}));
jest.mock('../push', () => ({ unregisterDevice: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `dicta://${path}` }));

it('asks a new person to confirm their email', async () => {
  mockSignUp.mockResolvedValue({ data: { user: { identities: [{ id: 'i1' }] }, session: null }, error: null });
  await expect(signUpWithEmail('new@example.com', 'secret123')).resolves.toEqual({ needsConfirmation: true });
});

it('says the email already has an account, where Supabase answers with a stand-in user and sends nothing', async () => {
  mockSignUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
  const error = await signUpWithEmail('taken@example.com', 'secret123').catch((e: unknown) => e);
  expect(friendlyError(error)).toBe('An account with this email already exists. Try signing in.');
});
