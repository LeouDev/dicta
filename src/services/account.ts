import { supabase } from '@/lib/supabase';

const BUCKETS = ['avatars', 'post-images', 'generated-cards'] as const;

/**
 * Permanently deletes the signed-in account: first the person's files (only
 * the owner can list/remove their own folder), then the auth user, which
 * cascades to their profile, posts, likes, comments, follows and saves.
 */
export async function deleteAccount(userId: string) {
  for (const bucket of BUCKETS) await removeFolder(bucket, userId);
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // The server-side session died with the user; clear the local one.
  await supabase.auth.signOut({ scope: 'local' });
}

/** Removes a folder's files, and its subfolders' (story photos are in <uid>/stories/). Folders list with a null id. */
async function removeFolder(bucket: string, folder: string) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
  if (error) throw error;
  for (const item of data ?? []) if (item.id === null) await removeFolder(bucket, `${folder}/${item.name}`);
  const paths = (data ?? []).filter((item) => item.id !== null).map((file) => `${folder}/${file.name}`);
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  }
}
