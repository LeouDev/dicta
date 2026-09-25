import { supabase } from '@/lib/supabase';

/*
 * Idempotent writes: "on" is an insert that ignores duplicates (the primary
 * key forbids them anyway), "off" is a delete. Counters and notifications are
 * maintained by database triggers, never by the client.
 */

async function run(query: PromiseLike<{ error: unknown }>) {
  const { error } = await query;
  if (error) throw error;
}

export function setLike(userId: string, postId: string, liked: boolean) {
  return run(
    liked
      ? supabase.from('likes').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
      : supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId),
  );
}

export function setSave(userId: string, postId: string, saved: boolean) {
  return run(
    saved
      ? supabase.from('saves').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
      : supabase.from('saves').delete().eq('user_id', userId).eq('post_id', postId),
  );
}

export function setCommentLike(userId: string, commentId: string, liked: boolean) {
  return run(
    liked
      ? supabase.from('comment_likes').upsert({ user_id: userId, comment_id: commentId }, { onConflict: 'user_id,comment_id', ignoreDuplicates: true })
      : supabase.from('comment_likes').delete().eq('user_id', userId).eq('comment_id', commentId),
  );
}

export function setFollow(userId: string, targetId: string, following: boolean) {
  if (userId === targetId) return Promise.reject(new Error('You can’t follow yourself.'));
  return run(
    following
      ? supabase.from('follows').upsert({ follower_id: userId, following_id: targetId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true })
      : supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId),
  );
}

/** Share counts can only be written by the server function. */
export function recordShare(postId: string) {
  return run(supabase.rpc('record_share', { p_post_id: postId }));
}
