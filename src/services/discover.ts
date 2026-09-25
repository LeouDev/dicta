import { supabase } from '@/lib/supabase';
import type { HashtagCount, ProfileView, Topic } from '@/types/models';

export async function fetchTopics(): Promise<Topic[]> {
  const { data, error } = await supabase.from('topics').select('slug, label').order('sort_order');
  if (error) throw error;
  return data;
}

const toCounts = (rows: { tag: string; post_count: number }[] | null): HashtagCount[] =>
  (rows ?? []).map((r) => ({ tag: r.tag, postCount: Number(r.post_count) }));

export async function fetchTrendingTags(): Promise<HashtagCount[]> {
  const { data, error } = await supabase.rpc('trending_hashtags', { p_days: 14, p_limit: 12 });
  if (error) throw error;
  return toCounts(data);
}

export async function searchTags(query: string): Promise<HashtagCount[]> {
  const { data, error } = await supabase.rpc('search_hashtags', { p_query: query, p_limit: 12 });
  if (error) throw error;
  return toCounts(data);
}

const PROFILE_SELECT = '*, followed_by_me';

/** Popular creators the viewer doesn't follow yet (server excludes self + blocked). */
export async function fetchSuggestedCreators(): Promise<ProfileView[]> {
  const { data, error } = await supabase.rpc('suggested_creators', { p_limit: 12 }).select(PROFILE_SELECT);
  if (error) throw error;
  return (data ?? []) as unknown as ProfileView[];
}

export async function searchProfiles(query: string): Promise<ProfileView[]> {
  const { data, error } = await supabase.rpc('search_profiles', { p_query: query, p_limit: 20 }).select(PROFILE_SELECT);
  if (error) throw error;
  return (data ?? []) as unknown as ProfileView[];
}

/** Classifies a search: "#tag" searches hashtags, "@name" people, anything else everything. */
export function parseSearch(input: string): { query: string; scope: 'all' | 'tags' | 'people' } {
  const trimmed = input.trim();
  if (trimmed.startsWith('#')) return { query: trimmed.replace(/^#+/, ''), scope: 'tags' };
  if (trimmed.startsWith('@')) return { query: trimmed.replace(/^@+/, ''), scope: 'people' };
  return { query: trimmed, scope: 'all' };
}

export const MIN_SEARCH_LENGTH = 2;
