import type { Session } from '@supabase/supabase-js';

import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { fetchProfile } from '@/services/profiles';

import { applySession, useAuth } from '../auth';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } } }));
jest.mock('@/services/profiles', () => ({ fetchProfile: jest.fn() }));

const fetchProfileMock = jest.mocked(fetchProfile);
const session = (userId: string) => ({ user: { id: userId } }) as unknown as Session;
const profile = (id: string) => ({ id, username: id }) as unknown as Awaited<ReturnType<typeof fetchProfile>>;

beforeAll(() => {
  // gcTime: Infinity avoids eviction timers keeping the Jest worker alive.
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
});

beforeEach(() => {
  useAuth.setState({ session: null, initialized: false });
  queryClient.clear();
  fetchProfileMock.mockReset();
});

describe('applySession', () => {
  it('marks the store initialized when there is no stored session', async () => {
    await applySession('INITIAL_SESSION', null);
    expect(useAuth.getState()).toMatchObject({ session: null, initialized: true });
    expect(fetchProfileMock).not.toHaveBeenCalled();
  });

  it('caches the profile before publishing a new session', async () => {
    let resolveProfile: (value: ReturnType<typeof profile>) => void = () => {};
    fetchProfileMock.mockReturnValue(new Promise((resolve) => (resolveProfile = resolve)));

    const pending = applySession('SIGNED_IN', session('u1'));
    await Promise.resolve();
    expect(useAuth.getState().session).toBeNull();

    resolveProfile(profile('u1'));
    await pending;
    expect(useAuth.getState().session?.user.id).toBe('u1');
    expect(queryClient.getQueryData(queryKeys.profile('u1'))).toEqual(profile('u1'));
  });

  it('still signs in when the profile fetch fails, leaving the error on the query', async () => {
    fetchProfileMock.mockRejectedValue(new Error('offline'));
    await applySession('SIGNED_IN', session('u1'));
    expect(useAuth.getState().session?.user.id).toBe('u1');
    expect(queryClient.getQueryState(queryKeys.profile('u1'))?.status).toBe('error');
  });

  it('does not refetch the profile on token refresh for the same user', async () => {
    fetchProfileMock.mockResolvedValue(profile('u1'));
    await applySession('SIGNED_IN', session('u1'));
    await applySession('TOKEN_REFRESHED', session('u1'));
    expect(fetchProfileMock).toHaveBeenCalledTimes(1);
  });

  it('clears cached data on sign out', async () => {
    fetchProfileMock.mockResolvedValue(profile('u1'));
    await applySession('SIGNED_IN', session('u1'));
    queryClient.setQueryData(['feed'], ['post']);

    await applySession('SIGNED_OUT', null);
    expect(useAuth.getState().session).toBeNull();
    expect(queryClient.getQueryData(['feed'])).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.profile('u1'))).toBeUndefined();
  });

  it('drops an older event that finishes after a newer one', async () => {
    let resolveProfile: (value: ReturnType<typeof profile>) => void = () => {};
    fetchProfileMock.mockReturnValue(new Promise((resolve) => (resolveProfile = resolve)));

    const slowSignIn = applySession('SIGNED_IN', session('u1'));
    await applySession('SIGNED_OUT', null);
    resolveProfile(profile('u1'));
    await slowSignIn;

    expect(useAuth.getState().session).toBeNull();
  });
});
