import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';

/**
 * Push notifications. The database queues a push when someone follows, likes,
 * comments or replies (never for your own actions, and once per thing), and
 * the website sends it through Expo to every device registered here.
 */
export type PushPermission = 'granted' | 'undetermined' | 'denied';

export async function pushPermission(): Promise<PushPermission> {
  const settings = await Notifications.getPermissionsAsync();
  const ios = settings.ios?.status;
  if (ios !== undefined) {
    if (ios === Notifications.IosAuthorizationStatus.NOT_DETERMINED) return 'undetermined';
    return ios === Notifications.IosAuthorizationStatus.DENIED ? 'denied' : 'granted';
  }
  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

// This device's token, once registered, so signing out can remove it.
let registered: string | null = null;

/** Registers this device for the signed-in person's pushes, if they've allowed notifications. */
export async function registerDevice(): Promise<void> {
  if ((await pushPermission()) !== 'granted') return;
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw error;
  registered = token;
}

/** Shows iOS's notification prompt (it only ever appears once) and registers the device. */
export async function enablePush(): Promise<PushPermission> {
  await Notifications.requestPermissionsAsync();
  const permission = await pushPermission();
  if (permission === 'granted') await registerDevice();
  return permission;
}

/** Stops pushes to this device. Call it before signing out, while the session still works. */
export async function unregisterDevice(): Promise<void> {
  if (!registered) return;
  const { error } = await supabase.from('push_tokens').delete().eq('token', registered);
  if (error) throw error;
  registered = null;
}

export const PUSH_KINDS = ['follows', 'likes', 'comments', 'replies'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushSettings = Record<PushKind, boolean>;

/** Which pushes the signed-in person wants; everything is on until they change it. */
export async function fetchPushSettings(): Promise<PushSettings> {
  const { data, error } = await supabase.from('push_settings').select('follows, likes, comments, replies').maybeSingle();
  if (error) throw error;
  return data ?? { follows: true, likes: true, comments: true, replies: true };
}

export async function savePushSettings(userId: string, settings: PushSettings): Promise<void> {
  const { error } = await supabase.from('push_settings').upsert({ user_id: userId, ...settings });
  if (error) throw error;
}
