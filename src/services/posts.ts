import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { validatePost } from '@/features/composer/validate';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import type { QuoteDesign } from '@/features/quote-card/types';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { FeedPost } from '@/types/models';

export const PAGE_SIZE = 12;

export interface FeedCursor {
  createdAt: string;
  id: string;
}

const POST_SELECT =
  'id, text, created_at, like_count, comment_count, share_count, save_count, ' +
  'author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url, is_verified), ' +
  'design:post_designs(design)';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Normalizes one PostgREST row; rows with a missing author are dropped. */
export function toFeedPost(row: unknown): FeedPost | null {
  if (!isRecord(row) || !isRecord(row.author)) return null;
  const a = row.author;
  const designRow = Array.isArray(row.design) ? row.design[0] : row.design;
  return {
    id: String(row.id),
    text: String(row.text ?? ''),
    createdAt: String(row.created_at),
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    shareCount: Number(row.share_count ?? 0),
    saveCount: Number(row.save_count ?? 0),
    author: {
      id: String(a.id),
      username: String(a.username ?? ''),
      displayName: String(a.display_name ?? ''),
      avatarUrl: typeof a.avatar_url === 'string' ? a.avatar_url : null,
      isVerified: a.is_verified === true,
    },
    design: parseQuoteDesign(isRecord(designRow) ? designRow.design : null),
  };
}

const toPage = (rows: unknown[] | null) => (rows ?? []).map(toFeedPost).filter((p): p is FeedPost => p !== null);

export const nextCursor = (page: FeedPost[]): FeedCursor | undefined => {
  const last = page.at(-1);
  return page.length === PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : undefined;
};

/** People you follow + you, newest first (keyset pagination). */
export async function fetchHomeFeed(cursor: FeedCursor | null): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .rpc('home_feed', { p_before: cursor?.createdAt, p_before_id: cursor?.id, p_limit: PAGE_SIZE })
    .select(POST_SELECT);
  if (error) throw error;
  return toPage(data as unknown[]);
}

export async function fetchUserPosts(userId: string, cursor: FeedCursor | null): Promise<FeedPost[]> {
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) {
    const at = `"${cursor.createdAt}"`;
    query = query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return toPage(data as unknown[]);
}

/** Uploads a local background photo to post-images/<uid>/ and returns the published design. */
async function uploadBackground(userId: string, design: QuoteDesign): Promise<QuoteDesign> {
  const bg = design.background;
  if (bg.type !== 'image' || !bg.uri?.startsWith('file://')) return design;
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  const bytes = await new File(bg.uri).arrayBuffer();
  const { error } = await supabase.storage.from('post-images').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  const uri = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
  return { ...design, background: { ...bg, uri, path } };
}

/** Validates, uploads any photo, and creates the post + design in one transaction. */
export async function publishPost({ userId, text, design }: { userId: string | null; text: string; design: QuoteDesign }) {
  if (!userId) throw new Error('Sign in to post.');
  const problem = validatePost(text, design);
  if (problem) throw new Error(problem);

  const published = parseQuoteDesign(await uploadBackground(userId, design));
  const { data, error } = await supabase.rpc('create_post', {
    p_text: text.trim(),
    p_template: published.template,
    p_design: published as unknown as Json,
    p_background_image_path: published.background.type === 'image' ? published.background.path : undefined,
  });
  if (error) throw error;
  return data;
}
