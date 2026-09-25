import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import type { Profile, ProfileView } from '@/types/models';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Someone's profile by handle, with whether the viewer follows them. */
export async function fetchProfileByUsername(username: string): Promise<ProfileView | null> {
  const { data, error } = await supabase.from('profiles').select('*, followed_by_me').eq('username', username.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data as ProfileView | null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', username);
  if (error) throw error;
  return count === 0;
}

const WIDTHS = { avatar: 512, cover: 1500 };

/** Resizes (a profile photo to 512px, a cover to 1500px), re-encodes as JPEG and uploads to avatars/<uid>/. Returns the public URL. */
export async function uploadAvatar(userId: string, localUri: string, kind: keyof typeof WIDTHS = 'avatar'): Promise<string> {
  const rendered = await ImageManipulator.manipulate(localUri).resize({ width: WIDTHS[kind] }).renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  const bytes = await new File(saved.uri).arrayBuffer();

  // A fresh name per upload sidesteps CDN caching of the old photo.
  const path = `${userId}/${kind}-${Date.now()}.jpg`;
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

/** "…/object/public/<bucket>/<path>" → "<path>" for files in our own storage. */
export function storagePath(bucket: string, publicUrl: string | null): string | null {
  const marker = `/object/public/${bucket}/`;
  const index = publicUrl?.indexOf(marker) ?? -1;
  return publicUrl && index >= 0 ? decodeURIComponent(publicUrl.slice(index + marker.length).split('?')[0]) : null;
}

export interface ProfileChanges {
  username: string;
  displayName: string;
  bio: string;
  /** New photo to upload, `null` to remove the current one, undefined to keep it. */
  avatar?: string | null;
  /** The cover photo, likewise. */
  cover?: string | null;
}

/** Updates the profile; a replaced or removed photo or cover is deleted from storage afterwards. */
export async function updateProfile(profile: Profile, changes: ProfileChanges): Promise<Profile> {
  const upload = (photo: string | null | undefined, kind: 'avatar' | 'cover') =>
    photo === undefined ? undefined : photo ? uploadAvatar(profile.id, photo, kind) : null;
  const [avatarUrl, coverUrl] = await Promise.all([upload(changes.avatar, 'avatar'), upload(changes.cover, 'cover')]);
  const { data, error } = await supabase
    .from('profiles')
    .update({
      username: changes.username,
      display_name: changes.displayName.trim(),
      bio: changes.bio.trim(),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}),
    })
    .eq('id', profile.id)
    .select('*')
    .single();
  if (error) throw error;

  const replaced = [avatarUrl !== undefined && profile.avatar_url, coverUrl !== undefined && profile.cover_url];
  const oldPaths = replaced.map((url) => (url ? storagePath('avatars', url) : null)).filter((path) => path !== null);
  if (oldPaths.length) await supabase.storage.from('avatars').remove(oldPaths);
  return data;
}
