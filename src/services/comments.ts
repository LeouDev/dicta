import { supabase } from '@/lib/supabase';
import type { CommentItem } from '@/types/models';

import { AUTHOR_SELECT, toAuthor, type FeedCursor } from './posts';

export const COMMENT_PAGE = 20;

// liked_by_me is the comments overload of the computed field.
const COMMENT_SELECT =
  'id, post_id, parent_id, body, created_at, like_count, reply_count, liked_by_me, ' +
  `author:profiles!comments_author_id_fkey(${AUTHOR_SELECT})`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function toComment(row: unknown): CommentItem | null {
  if (!isRecord(row) || !isRecord(row.author)) return null;
  return {
    id: String(row.id),
    postId: String(row.post_id),
    parentId: typeof row.parent_id === 'string' ? row.parent_id : null,
    body: String(row.body ?? ''),
    createdAt: String(row.created_at),
    likeCount: Number(row.like_count ?? 0),
    replyCount: Number(row.reply_count ?? 0),
    likedByMe: row.liked_by_me === true,
    author: toAuthor(row.author),
  };
}

const toList = (rows: unknown) => ((rows ?? []) as unknown[]).map(toComment).filter((c): c is CommentItem => c !== null);

export const nextCommentCursor = (page: CommentItem[]): FeedCursor | undefined => {
  const last = page.at(-1);
  return page.length === COMMENT_PAGE && last ? { createdAt: last.createdAt, id: last.id } : undefined;
};

/** Oldest first, so a conversation reads top to bottom. */
function oldestFirst<Q extends { order: (c: string, o: { ascending: boolean }) => Q; limit: (n: number) => Q; or: (f: string) => Q }>(
  query: Q,
  cursor: FeedCursor | null,
): Q {
  let q = query.order('created_at', { ascending: true }).order('id', { ascending: true }).limit(COMMENT_PAGE);
  if (cursor) {
    const at = `"${cursor.createdAt}"`;
    q = q.or(`created_at.gt.${at},and(created_at.eq.${at},id.gt.${cursor.id})`);
  }
  return q;
}

export async function fetchComments(postId: string, cursor: FeedCursor | null) {
  const { data, error } = await oldestFirst(
    supabase.from('comments').select(COMMENT_SELECT).eq('post_id', postId).is('parent_id', null),
    cursor,
  );
  if (error) throw error;
  return toList(data);
}

export async function fetchReplies(parentId: string, cursor: FeedCursor | null) {
  const { data, error } = await oldestFirst(supabase.from('comments').select(COMMENT_SELECT).eq('parent_id', parentId), cursor);
  if (error) throw error;
  return toList(data);
}

export async function addComment(input: { userId: string; postId: string; parentId: string | null; body: string }) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ author_id: input.userId, post_id: input.postId, parent_id: input.parentId, body: input.body.trim() })
    .select(COMMENT_SELECT)
    .single();
  if (error) throw error;
  const comment = toComment(data);
  if (!comment) throw new Error('Comment was saved but could not be read back.');
  return comment;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

export const COMMENT_MAX_LENGTH = 1000;
