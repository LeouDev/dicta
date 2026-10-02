import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { validatePost } from '@/features/composer/validate';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import type { CardAuthor, QuoteDesign } from '@/features/quote-card/types';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { CardContent, FeedPost } from '@/types/models';

import { AUTHOR_SELECT, toAuthor } from './author';
import { prepareCardImage } from './web';

export { AUTHOR_SELECT, toAuthor };

export const PAGE_SIZE = 12;

export interface FeedCursor {
  createdAt: string;
  id: string;
}

// liked_by_me / saved_by_me are computed fields (SQL functions on the posts row).
const POST_SELECT =
  'id, text, topic, status, pinned_at, created_at, like_count, comment_count, share_count, save_count, liked_by_me, saved_by_me, ' +
  `author:profiles!posts_author_id_fkey(${AUTHOR_SELECT}), ` +
  'design:post_designs(design), cards:post_cards(position, text, design)';

/** A post holds up to 10 cards: itself and nine more (post_cards). */
export const MAX_CARDS = 10;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

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
    cards: (Array.isArray(row.cards) ? row.cards : [])
      .filter(isRecord)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((card) => ({ text: String(card.text ?? ''), design: parseQuoteDesign(card.design) })),
    pinnedAt: typeof row.pinned_at === 'string' ? row.pinned_at : null,
    status: typeof row.status === 'string' ? row.status : 'published',
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

/**
 * A profile's posts, newest first. Pinned posts are left out here and shown
 * first (fetchPinnedPosts); archived ones only in the author's Archive.
 */
export function fetchUserPosts(userId: string, cursor: FeedCursor | null) {
  return rows(newestFirst(supabase.from('posts').select(POST_SELECT).eq('author_id', userId).neq('status', 'archived').is('pinned_at', null), cursor));
}

/** The (up to three) posts pinned to the top of a profile, most recently pinned first. */
export function fetchPinnedPosts(userId: string) {
  return rows(
    supabase.from('posts').select(POST_SELECT).eq('author_id', userId).eq('status', 'published').not('pinned_at', 'is', null).order('pinned_at', { ascending: false }),
  );
}

/** Your archived posts (RLS shows them to their author only). */
export function fetchArchivedPosts(userId: string, cursor: FeedCursor | null) {
  return rows(newestFirst(supabase.from('posts').select(POST_SELECT).eq('author_id', userId).eq('status', 'archived'), cursor));
}

/** Everyone's newest posts (Discover). RLS already hides blocked people and private accounts. */
export function fetchRecentPosts(cursor: FeedCursor | null) {
  return rows(newestFirst(supabase.from('posts').select(POST_SELECT).eq('status', 'published'), cursor));
}

export function fetchTopicPosts(slug: string, cursor: FeedCursor | null) {
  return rows(newestFirst(supabase.from('posts').select(POST_SELECT).eq('status', 'published').eq('topic', slug), cursor));
}

export function fetchTagPosts(tag: string, cursor: FeedCursor | null) {
  return rows(
    newestFirst(
      supabase.from('posts').select(`${POST_SELECT}, post_hashtags!inner(tag)`).eq('status', 'published').eq('post_hashtags.tag', tag.toLowerCase()),
      cursor,
    ),
  );
}

/** Archives one of your posts (only you see it, likes and comments kept) or brings it back. */
export async function setArchived(postId: string, archived: boolean) {
  const { error } = await supabase.rpc('set_post_archived', { p_post_id: postId, p_archived: archived });
  if (error) throw error;
}

/** Pins one of your posts to the top of your profile (up to 3), or unpins it. */
export async function setPinned(postId: string, pinned: boolean) {
  const { error } = await supabase.rpc('set_post_pinned', { p_post_id: postId, p_pinned: pinned });
  if (error) throw error;
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

/** Uploads a local background photo to post-images/<uid>/ (stories: …/stories/) and returns the published design. */
export async function uploadBackground(userId: string, design: QuoteDesign, folder = ''): Promise<QuoteDesign> {
  const bg = design.background;
  if (bg.type !== 'image' || !bg.image?.startsWith('file://')) return design;
  const path = `${userId}/${folder}${Crypto.randomUUID()}.jpg`;
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
  /** The cards after the first, for a stack. */
  cards?: CardContent[];
  topic?: string | null;
  /** The poster, as their card shows them. */
  author: CardAuthor;
}

const photoPath = (design: QuoteDesign) => (design.background.type === 'image' ? (design.background.path ?? null) : null);

/** Why a stack can't be published yet: the first card that isn't ready, by number. */
function validateStack(text: string, design: QuoteDesign, cards: CardContent[]): string | null {
  const all = [{ text, design }, ...cards];
  if (all.length > MAX_CARDS) return `A post holds up to ${MAX_CARDS} cards.`;
  for (const [i, card] of all.entries()) {
    const problem = validatePost(card.text, card.design);
    if (problem) return all.length > 1 ? `Card ${i + 1}: ${problem}` : problem;
  }
  return null;
}

/** Uploads each extra card's photo and shapes the cards for create_post / set_post_cards. */
async function publishCards(userId: string, cards: CardContent[]) {
  const published = await Promise.all(cards.map(async (card) => ({ text: card.text.trim(), design: parseQuoteDesign(await uploadBackground(userId, card.design)) })));
  const json = published.map((card) => ({
    text: card.text,
    template: card.design.template,
    design: card.design,
    background_image_path: photoPath(card.design),
  }));
  return { published, json: json as unknown as Json };
}

/** Validates, uploads any photos, and creates the post, its design and its other cards in one transaction. */
export async function publishPost({ userId, text, design, cards = [], topic, author }: NewPost) {
  if (!userId) throw new Error('Sign in to post.');
  const problem = validateStack(text, design, cards);
  if (problem) throw new Error(problem);

  const published = parseQuoteDesign(await uploadBackground(userId, design));
  const stack = await publishCards(userId, cards);
  const { data, error } = await supabase.rpc('create_post', {
    p_text: text.trim(),
    p_template: published.template,
    p_design: published as unknown as Json,
    p_topic: topic ?? undefined,
    p_background_image_path: photoPath(published) ?? undefined,
    p_cards: cards.length ? stack.json : undefined,
  });
  if (error) throw error;
  drawCardImages({ postId: data, authorId: userId, text: text.trim(), design: published, author });
  return data;
}

interface PostEdit extends NewPost {
  postId: string;
  /** The uploaded photos the post's cards showed until now, removed once nothing uses them. */
  previousPhotos: string[];
}

/** Saves new words, designs and cards over one of your posts. Returns them as stored. */
export async function updatePost({ postId, previousPhotos, userId, text, design, cards = [], topic, author }: PostEdit) {
  if (!userId) throw new Error('Sign in to edit.');
  const problem = validateStack(text, design, cards);
  if (problem) throw new Error(problem);

  const saved = parseQuoteDesign(await uploadBackground(userId, design));
  const photo = photoPath(saved);
  const stack = await publishCards(userId, cards);
  const edit = { text: text.trim(), topic: topic ?? null, design: saved, cards: stack.published };
  // One transaction: if the content filter rejects any card, nothing has changed.
  const { error } = await supabase.rpc('update_post', {
    p_post_id: postId,
    p_text: edit.text,
    p_topic: edit.topic as string, // null clears it
    p_template: saved.template,
    p_design: saved as unknown as Json,
    p_background_image_path: photo ?? undefined,
    p_cards: stack.json,
  });
  if (error) throw error;

  const kept = new Set([photo, ...stack.published.map((card) => photoPath(card.design))]);
  await removeUnusedPhotos(previousPhotos.filter((path) => !kept.has(path)));
  drawCardImages({ postId, authorId: userId, text: edit.text, design: saved, author });
  return edit;
}

/** Every uploaded photo a post's cards show. */
export const postPhotos = (post: Pick<FeedPost, 'design' | 'cards'>) =>
  [post.design, ...post.cards.map((card) => card.design)].map(photoPath).filter((path): path is string => path !== null);

/**
 * The website's image and link preview for this version of a post, drawn here
 * in the background. If that fails, the website draws them itself.
 */
function drawCardImages(post: Parameters<typeof import('./card-images').storeCardImages>[0]) {
  Promise.resolve()
    .then(() => {
      // Required lazily: it brings in Skia, which the other services (and their tests) don't load.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { storeCardImages } = require('./card-images') as typeof import('./card-images');
      return storeCardImages(post);
    })
    .catch(() => prepareCardImage(post.postId));
}

/** Deletes a post (likes, comments, saves and cards cascade), its uploaded photos and its website images. */
export async function deletePost(post: FeedPost) {
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (error) throw error;
  // The website drops its cached page and images by itself (a database trigger calls api/purge).
  await removeUnusedPhotos(postPhotos(post));
  // The website stores each version of the card as <author>/<post id>-<version>.jpg (web/api/card.js).
  const { data: cards } = await supabase.storage.from('generated-cards').list(post.author.id, { search: `${post.id}-` });
  const paths = (cards ?? []).filter((file) => file.name.startsWith(`${post.id}-`)).map((file) => `${post.author.id}/${file.name}`);
  if (paths.length) await supabase.storage.from('generated-cards').remove(paths);
}

/** Whether a post, a stacked card or a story still shows this uploaded photo (so it mustn't be deleted yet). */
async function isPhotoInUse(path: string) {
  const counts = await Promise.all([
    supabase.from('post_designs').select('post_id', { count: 'exact', head: true }).eq('background_image_path', path),
    supabase.from('post_cards').select('post_id', { count: 'exact', head: true }).eq('background_image_path', path),
    supabase.from('stories').select('id', { count: 'exact', head: true }).eq('background_image_path', path),
  ]);
  return counts.some(({ count, error }) => Boolean(error) || (count ?? 0) > 0);
}

/** Removes uploaded photos nothing shows anymore. */
export async function removeUnusedPhotos(paths: (string | null)[]) {
  const unused: string[] = [];
  for (const path of new Set(paths)) {
    if (path && !(await isPhotoInUse(path))) unused.push(path);
  }
  if (unused.length) await supabase.storage.from('post-images').remove(unused);
}
