import { supabase } from '@/lib/supabase';
import type { PostAuthor } from '@/types/models';

import { AUTHOR_SELECT, toAuthor } from './posts';

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'self_harm', label: 'Self-harm or suicide' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'misinformation', label: 'False information' },
  { value: 'other', label: 'Something else' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export interface ReportInput {
  reporterId: string;
  reason: ReportReason;
  details?: string;
  postId?: string;
  userId?: string;
  commentId?: string;
}

/** Files a report into the moderation queue (reports table). */
export async function submitReport({ reporterId, reason, details, postId, userId, commentId }: ReportInput) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reason,
    details: details?.trim() || null,
    post_id: postId ?? null,
    reported_user_id: userId ?? null,
    comment_id: commentId ?? null,
  });
  if (error) throw error;
}

/** Blocking also removes follows and notifications between you (database trigger). */
export async function setBlocked(userId: string, targetId: string, blocked: boolean) {
  const { error } = blocked
    ? await supabase.from('blocks').upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
    : await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', targetId);
  if (error) throw error;
}

export interface BlockedAccount {
  blockedAt: string;
  profile: PostAuthor;
}

export async function fetchBlocked(userId: string): Promise<BlockedAccount[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select(`created_at, blocked:profiles!blocks_blocked_id_fkey(${AUTHOR_SELECT})`)
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { created_at: string; blocked: Record<string, unknown> | null }[])
    .filter((row) => row.blocked)
    .map((row) => ({ blockedAt: row.created_at, profile: toAuthor(row.blocked!) }));
}
