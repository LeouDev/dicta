import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { fetchProfile } from '@/services/profiles';

interface AuthState {
  session: Session | null;
  /** False until Supabase has restored (or failed to restore) the stored session. */
  initialized: boolean;
}

export const useAuth = create<AuthState>()(() => ({
  session: null,
  initialized: false,
}));

export const selectUserId = (s: AuthState) => s.session?.user.id ?? null;

let latestEvent = 0;

/**
 * Applies an auth event. When a new user signs in, their profile is fetched
 * *before* the session is published, so navigation guards never see
 * "signed in, profile unknown" and flash the profile-setup screen.
 */
export async function applySession(event: AuthChangeEvent, session: Session | null) {
  const eventId = ++latestEvent;
  const previousUserId = useAuth.getState().session?.user.id ?? null;
  const nextUserId = session?.user.id ?? null;

  // Another user's cached data must never leak into the next session.
  if (event === 'SIGNED_OUT' || previousUserId !== nextUserId) queryClient.clear();

  if (nextUserId && nextUserId !== previousUserId) {
    // prefetchQuery never throws; a failure surfaces as the query's error state.
    await queryClient.prefetchQuery({ queryKey: queryKeys.profile(nextUserId), queryFn: () => fetchProfile(nextUserId) });
  }

  if (eventId !== latestEvent) return; // superseded by a newer event
  useAuth.setState({ session, initialized: true });
}

/** Subscribes the store to Supabase auth. Returns the unsubscribe function. */
export function startAuthListener() {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // Supabase warns against awaiting its own calls inside this callback (it can deadlock).
    setTimeout(() => void applySession(event, session), 0);
  });
  return () => data.subscription.unsubscribe();
}
