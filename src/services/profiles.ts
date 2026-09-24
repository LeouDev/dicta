import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/models';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', username);
  if (error) throw error;
  return count === 0;
}

/** Resizes to 512px, re-encodes as JPEG and uploads to avatars/<uid>/. Returns the public URL. */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(localUri).resize({ width: 512 }).renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  const bytes = await new File(saved.uri).arrayBuffer();

  // A fresh name per upload sidesteps CDN caching of the old photo.
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export interface NewProfile {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarLocalUri?: string | null;
}

export async function createProfile({ userId, username, displayName, bio = '', avatarLocalUri }: NewProfile) {
  const avatarUrl = avatarLocalUri ? await uploadAvatar(userId, avatarLocalUri) : null;
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username, display_name: displayName.trim(), bio: bio.trim(), avatar_url: avatarUrl })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
