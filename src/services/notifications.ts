import { parseQuoteDesign } from '@/features/quote-card/serialize';
import { supabase } from '@/lib/supabase';
import type { NotificationItem, NotificationType } from '@/types/models';

import { AUTHOR_SELECT, toAuthor, type FeedCursor } from './posts';

export const NOTIFICATION_PAGE = 20;

const NOTIFICATION_SELECT =
  `id, type, read_at, created_at, actor:profiles!notifications_actor_id_fkey(${AUTHOR_SELECT}), ` +
  `post:posts(id, text, author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}), design:post_designs(design)), ` +
  'comment:comments(id, body)';

const TYPES: NotificationType[] = ['follow', 'like', 'comment', 'reply', 'mention', 'comment_like'];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function toNotification(row: unknown): NotificationItem | null {
  if (!isRecord(row) || !isRecord(row.actor) || !TYPES.includes(row.type as NotificationType)) return null;
  const post = isRecord(row.post) && isRecord(row.post.author) ? row.post : null;
  const designRow = post ? (Array.isArray(post.design) ? post.design[0] : post.design) : null;
  return {
    id: String(row.id),
    type: row.type as NotificationType,
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
    createdAt: String(row.created_at),
    actor: toAuthor(row.actor),
    post: post
      ? {
          id: String(post.id),
          text: String(post.text ?? ''),
          author: toAuthor(post.author as Record<string, unknown>),
          design: parseQuoteDesign(isRecord(designRow) ? designRow.design : null),
        }
      : null,
    comment: isRecord(row.comment) ? { id: String(row.comment.id), body: String(row.comment.body ?? '') } : null,
  };
}

export const nextNotificationCursor = (page: NotificationItem[]): FeedCursor | undefined => {
  const last = page.at(-1);
  return page.length === NOTIFICATION_PAGE && last ? { createdAt: last.createdAt, id: last.id } : undefined;
};

/** Newest first. RLS limits this to the viewer's own, minus blocked people. */
export async function fetchNotifications(cursor: FeedCursor | null): Promise<NotificationItem[]> {
  let query = supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATION_PAGE);
  if (cursor) {
    const at = `"${cursor.createdAt}"`;
    query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[]).map(toNotification).filter((n): n is NotificationItem => n !== null);
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** Marks the given notifications (or all unread ones) read; RLS scopes it to the viewer. */
export async function markRead(ids?: string[]) {
  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (ids) query = query.in('id', ids);
  const { error } = await query;
  if (error) throw error;
}

const excerpt = (text: string, max = 60) => {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
};

/** The sentence after the actor's name, e.g. "liked your quote." */
export function notificationMessage(n: Pick<NotificationItem, 'type' | 'comment'>): string {
  const said = n.comment ? `: “${excerpt(n.comment.body)}”` : '.';
  switch (n.type) {
    case 'follow':
      return 'started following you.';
    case 'like':
      return 'liked your quote.';
    case 'comment':
      return `commented${said}`;
    case 'reply':
      return `replied to your comment${said}`;
    case 'mention':
      return `mentioned you${said}`;
    case 'comment_like':
      return 'liked your comment.';
  }
}
