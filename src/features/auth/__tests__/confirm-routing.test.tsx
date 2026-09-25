import type { Session } from '@supabase/supabase-js';
import { act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { useAuth } from '@/store/auth';

// The real root layout and its guards; screens, fonts, Supabase and push are stubbed.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/store/auth', () => ({ ...jest.requireActual('@/store/auth'), startAuthListener: () => () => {} }));
jest.mock('@/hooks/use-my-profile', () => ({ useMyProfile: () => mockProfile }));
jest.mock('@/hooks/use-push', () => ({ usePushNotifications: () => {} }));
jest.mock('@/features/quote-card/fonts', () => ({ loadCardFonts: () => Promise.resolve() }));
jest.mock('@/components/toast', () => ({ Toaster: () => null }));
jest.mock('@/components/ui/empty-state', () => ({ EmptyState: () => null }));
jest.mock('expo-font', () => ({ ...jest.requireActual('expo-font'), useFonts: () => [true, null] }));

let mockProfile: { data: object | null; isError: boolean };
function page(name: string) {
  return function StubScreen() {
    return <Text>{name}</Text>;
  };
}
const ROUTES = {
  _layout: RootLayout,
  '(auth)/welcome': page('welcome'),
  'auth-callback': page('confirming'),
  'create-profile': page('create profile'),
  '(tabs)/index': page('feed'),
};
const SESSION = { user: { id: 'u1' } } as Session;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {}); // routes the stubs leave out
  useAuth.setState({ session: null, initialized: true });
});

it('moves on from the email confirmation once signed in: to profile setup when new, to the feed otherwise', async () => {
  mockProfile = { data: null, isError: false };
  const app = renderRouter(ROUTES, { initialUrl: '/auth-callback' });
  await waitFor(() => expect(app.getPathname()).toBe('/auth-callback'));
  await act(async () => useAuth.setState({ session: SESSION }));
  await waitFor(() => expect(app.getPathname()).toBe('/create-profile'));

  // Signed out again, a person with a profile opens a confirmation link.
  mockProfile = { data: { id: 'u1' }, isError: false };
  await act(async () => useAuth.setState({ session: null }));
  await act(async () => router.push('/auth-callback'));
  await waitFor(() => expect(app.getPathname()).toBe('/auth-callback'));
  await act(async () => useAuth.setState({ session: SESSION }));
  await waitFor(() => expect(app.getPathname()).toBe('/'));
});
