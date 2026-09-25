import 'expo-sqlite/localStorage/install';
import './web-crypto';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@/types/database';

// Static `process.env.EXPO_PUBLIC_*` access is required for Expo to inline them.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

if (!isSupabaseConfigured && __DEV__) {
  console.warn('Supabase is not configured. Copy .env.example to .env.local and fill in your project URL and key.');
}

export const supabase = createClient<Database>(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
