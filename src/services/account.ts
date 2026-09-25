import { supabase } from '@/lib/supabase';

const BUCKETS = ['avatars', 'post-images', 'generated-cards'] as const;

/**
 * Permanently deletes the signed-in account: first the person's files (only
 * the owner can list/remove their own folder), then the auth user, which
 * cascades to their profile, posts, likes, comments, follows and saves.
 */
export async function deleteAccount(userId: string) {
  for (const bucket of BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) throw error;
    const paths = (data ?? []).map((file) => `${userId}/${file.name}`);
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
      if (removeError) throw removeError;
    }
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // The server-side session died with the user; clear the local one.
  await supabase.auth.signOut({ scope: 'local' });
}
