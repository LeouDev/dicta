import { validatePost } from '@/features/composer/validate';
import { parseQuoteDesign } from '@/features/quote-card/serialize';
import type { QuoteDesign } from '@/features/quote-card/types';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import type { PostAuthor, Story, StoryRing } from '@/types/models';

import { AUTHOR_SELECT, toAuthor } from './author';
import { removeUnusedPhotos, uploadBackground } from './posts';

/*
 * Stories: a card that disappears after 24 hours. The database decides who
 * sees them (the author's followers, or anyone for a public account) and hides
 * them once they expire; the author's app deletes its own expired stories.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The rings at the top of Home: you first, then people you follow with a live story, unseen first. */
export async function fetchStoryTray(): Promise<StoryRing[]> {
  const { data, error } = await supabase.rpc('story_tray');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    author: toAuthor({ id: row.author_id, username: row.username, display_name: row.display_name, avatar_url: row.avatar_url, is_verified: row.is_verified }),
    latestAt: row.latest_at,
    unseen: row.unseen,
  }));
}

/** Someone's live stories, oldest first (the order they play), with which ones you've seen. */
export async function fetchStories(authorId: string, viewerId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select(`id, author_id, text, design, created_at, expires_at, author:profiles!stories_author_id_fkey(${AUTHOR_SELECT})`)
    .eq('author_id', authorId)
    .eq('status', 'published')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;
  const ids = (data ?? []).map((row) => row.id);
  const seen = new Set<string>();
  if (ids.length && viewerId !== authorId) {
    const views = await supabase.from('story_views').select('story_id').eq('viewer_id', viewerId).in('story_id', ids);
    if (views.error) throw views.error;
    for (const view of views.data ?? []) seen.add(view.story_id);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    authorId: row.author_id,
    author: toAuthor(isRecord(row.author) ? row.author : { id: row.author_id }),
    text: row.text,
    design: parseQuoteDesign(row.design),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewedByMe: viewerId === authorId || seen.has(row.id),
  }));
}

/** Validates, uploads any photo (post-images/<uid>/stories/) and posts the story. */
export async function publishStory({ userId, text, design }: { userId: string | null; text: string; design: QuoteDesign }) {
  if (!userId) throw new Error('Sign in to share a story.');
  const problem = validatePost(text, design);
  if (problem) throw new Error(problem);
  const published = parseQuoteDesign(await uploadBackground(userId, design, 'stories/'));
  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: userId,
      text: text.trim(),
      template: published.template,
      design: published as unknown as Json,
      background_image_path: published.background.type === 'image' ? (published.background.path ?? null) : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Records that you saw a story (once; a repeat is ignored). */
export async function markStoryViewed(storyId: string, viewerId: string) {
  const { error } = await supabase
    .from('story_views')
    .upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true });
  if (error) throw error;
}

export interface StoryViewer {
  viewer: PostAuthor;
  viewedAt: string;
}

/** Who saw one of your stories, most recent first (RLS shows views to the author only). */
export async function fetchStoryViewers(storyId: string): Promise<StoryViewer[]> {
  const { data, error } = await supabase
    .from('story_views')
    .select(`viewed_at, viewer:profiles!story_views_viewer_id_fkey(${AUTHOR_SELECT})`)
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { viewed_at: string; viewer: unknown }[])
    .filter((row) => isRecord(row.viewer))
    .map((row) => ({ viewedAt: row.viewed_at, viewer: toAuthor(row.viewer as Record<string, unknown>) }));
}

/** Deletes one of your stories and its photo (unless something else still shows it). */
export async function deleteStory(story: Pick<Story, 'id' | 'design'>) {
  const { error } = await supabase.from('stories').delete().eq('id', story.id);
  if (error) throw error;
  const bg = story.design.background;
  await removeUnusedPhotos([bg.type === 'image' ? (bg.path ?? null) : null]);
}

/** Deletes your stories that have expired, and their photos. Run when the app opens. */
export async function cleanUpExpiredStories(userId: string) {
  const { data, error } = await supabase
    .from('stories')
    .select('id, background_image_path')
    .eq('author_id', userId)
    .lt('expires_at', new Date().toISOString());
  if (error) throw error;
  if (!data?.length) return;
  const gone = await supabase.from('stories').delete().in('id', data.map((row) => row.id));
  if (gone.error) throw gone.error;
  await removeUnusedPhotos(data.map((row) => row.background_image_path));
}
