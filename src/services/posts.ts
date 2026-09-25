import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { validatePost } from '@/features/composer/validate';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import type { QuoteDesign } from '@/features/quote-card/types';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { FeedPost, PostAuthor } from '@/types/models';

export const PAGE_SIZE = 12;

export interface FeedCursor {
  createdAt: string;
  id: string;
}

export const AUTHOR_SELECT = 'id, username, display_name, avatar_url, is_verified';

// liked_by_me / saved_by_me are computed fields (SQL functions on the posts row).
const POST_SELECT =
  'id, text, topic, created_at, like_count, comment_count, share_count, save_count, liked_by_me, saved_by_me, ' +
  `author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}), ` +
  'design:post_designs(design)';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function toAuthor(row: Record<string, unknown>): PostAuthor {
  return {
    id: String(row.id),
    username: String(row.username ?? ''),
    displayName: String(row.display_name ?? ''),
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    isVerified: row.is_verified === true,
  };
}

/** Normalizes one PostgREST row; rows with a missing author are dropped. */
export function toFeedPost(row: unknown): FeedPost | null {
  if (!isRecord(row) || !isRecord(row.author)) return null;
  const designRow = Array.isArray(row.design) ? row.design[0] : row.design;
  return {
    id: String(row.id),
    text: String(row.text ?? ''),
    createdAt: String(row.created_at),
    topic: typeof row.topic === 'string' ? row.topic : null,
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    shareCount: Number(row.share_count ?? 0),
    saveCount: Number(row.save_count ?? 0),
    likedByMe: row.liked_by_me === true,
    savedByMe: row.saved_by_me === true,
    author: toAuthor(row.author),
    design: parseQuoteDesign(isRecord(designRow) ? designRow.design : null),
  };
}

const toPage = (rows: unknown[] | null) => (rows ?? []).map(toFeedPost).filter((p): p is FeedPost => p !== null);

export const nextCursor = (page: FeedPost[]): FeedCursor | undefined => {
  const last = page.at(-1);
  return page.length === PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : undefined;
};

/** For offset-paginated lists (trending, search, saved). */
export const nextOffset = (page: FeedPost[], pages: FeedPost[][]): number | undefined =>
  page.length === PAGE_SIZE ? pages.reduce((n, p) => n + p.length, 0) : undefined;

async function rows(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<FeedPost[]> {
  const { data, error } = await query;
  if (error) throw error;
  return toPage(data as unknown[]);
}

/** Newest first, keyset-paginated on (created_at, id). */
function newestFirst<Q extends { order: (c: string, o: { ascending: boolean }) => Q; limit: (n: number) => Q; or: (f: string) => Q }>(
  query: Q,
  cursor: FeedCursor | null,
): Q {
  let q = query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
  if (cursor) {
    const at = `"${cursor.createdAt}"`;
    q = q.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`);
  }
  return q;
}

/** People you follow + you, newest first. */
export function fetchHomeFeed(cursor: FeedCursor | null) {
  return rows(supabase.rpc('home_feed', { p_before: cursor?.createdAt, p_before_id: cursor?.id, p_limit: PAGE_SIZE }).select(POST_SELECT));
}

export function fetchUserPosts(userId: string, cursor: FeedCursor | null) {
  return rows(newestFirst(supabase.from('posts').select(POST_SELECT).eq('author_id', userId), cursor));
}

/** Everyone's newest posts (Discover). RLS already hides blocked people. */
export function fetchRecentPosts(cursor: FeedCursor | null) {
  return rows(newestFirst(supabase.from('posts').select(POST_SELECT), cursor));
}

export function fetchTopicPosts(slug: string, cursor: FeedCursor | null) {
  return rows(newestFirst(supabase.from('posts').select(POST_SELECT).eq('topic', slug), cursor));
}

export function fetchTagPosts(tag: string, cursor: FeedCursor | null) {
  return rows(
    newestFirst(supabase.from('posts').select(`${POST_SELECT}, post_hashtags!inner(tag)`).eq('post_hashtags.tag', tag.toLowerCase()), cursor),
  );
}

export function fetchTrendingPosts(offset: number) {
  return rows(supabase.rpc('trending_posts', { p_days: 7, p_limit: PAGE_SIZE, p_offset: offset }).select(POST_SELECT));
}

export function searchPosts(query: string, offset: number) {
  return rows(supabase.rpc('search_posts', { p_query: query, p_limit: PAGE_SIZE, p_offset: offset }).select(POST_SELECT));
}

/** Saved posts reference the original post; nothing is copied. */
export async function fetchSavedPosts(userId: string, offset: number): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('saves')
    .select(`created_at, post:posts(${POST_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return toPage(((data ?? []) as { post: unknown }[]).map((row) => row.post));
}

export async function fetchPost(postId: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', postId).maybeSingle();
  if (error) throw error;
  return toFeedPost(data);
}

/** Uploads a local background photo to post-images/<uid>/ and returns the published design. */
async function uploadBackground(userId: string, design: QuoteDesign): Promise<QuoteDesign> {
  const bg = design.background;
  if (bg.type !== 'image' || !bg.image?.startsWith('file://')) return design;
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  const bytes = await new File(bg.image).arrayBuffer();
  const { error } = await supabase.storage.from('post-images').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  const image = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
  return { ...design, background: { ...bg, image, path } };
}

interface NewPost {
  userId: string | null;
  text: string;
  design: QuoteDesign;
  topic?: string | null;
}

/** Validates, uploads any photo, and creates the post + design in one transaction. */
export async function publishPost({ userId, text, design, topic }: NewPost) {
  if (!userId) throw new Error('Sign in to post.');
  const problem = validatePost(text, design);
  if (problem) throw new Error(problem);

  const published = parseQuoteDesign(await uploadBackground(userId, design));
  const { data, error } = await supabase.rpc('create_post', {
    p_text: text.trim(),
    p_template: published.template,
    p_design: published as unknown as Json,
    p_topic: topic ?? undefined,
    p_background_image_path: published.background.type === 'image' ? published.background.path : undefined,
  });
  if (error) throw error;
  return data;
}

/** Deletes a post (likes, comments, saves cascade) and its uploaded photo, if any. */
export async function deletePost(post: FeedPost) {
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (error) throw error;
  const bg = post.design.background;
  if (bg.type === 'image' && bg.path) await supabase.storage.from('post-images').remove([bg.path]);
}
