import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { findPost } from '@/lib/cache';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchHomeFeed,
  fetchPost,
  fetchRecentPosts,
  fetchSavedPosts,
  fetchTagPosts,
  fetchTopicPosts,
  fetchTrendingPosts,
  fetchUserPosts,
  nextCursor,
  nextOffset,
  searchPosts,
  type FeedCursor,
} from '@/services/posts';
import { selectUserId, useAuth } from '@/store/auth';
import type { FeedPost } from '@/types/models';

function useCursorPosts(key: readonly unknown[], fetch: (cursor: FeedCursor | null) => Promise<FeedPost[]>, enabled = true) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetch(pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextCursor,
    enabled,
  });
}

function useOffsetPosts(key: readonly unknown[], fetch: (offset: number) => Promise<FeedPost[]>, enabled = true) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetch(pageParam),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
    enabled,
  });
}

export function useHomeFeed() {
  const userId = useAuth(selectUserId);
  return useCursorPosts(queryKeys.homeFeed(userId), fetchHomeFeed, userId !== null);
}

export function useUserPosts(userId: string | null) {
  return useCursorPosts(queryKeys.userPosts(userId), (c) => fetchUserPosts(userId!, c), userId !== null);
}

export function useSavedPosts(enabled = true) {
  const userId = useAuth(selectUserId);
  return useOffsetPosts(queryKeys.savedPosts(userId), (o) => fetchSavedPosts(userId!, o), enabled && userId !== null);
}

export const useRecentPosts = () => useCursorPosts(queryKeys.recentPosts(), fetchRecentPosts);
export const useTrendingPosts = () => useOffsetPosts(queryKeys.trendingPosts(), fetchTrendingPosts);
export const useTopicPosts = (slug: string) => useCursorPosts(queryKeys.topicPosts(slug), (c) => fetchTopicPosts(slug, c));
export const useTagPosts = (tag: string) => useCursorPosts(queryKeys.tagPosts(tag), (c) => fetchTagPosts(tag, c));
export const useSearchPosts = (query: string) =>
  useOffsetPosts(queryKeys.searchPosts(query), (o) => searchPosts(query, o), query.length >= 2);

/** One post; renders instantly from any list that already has it. */
export function usePost(postId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.post(postId),
    queryFn: () => fetchPost(postId),
    initialData: () => findPost(client, postId),
    initialDataUpdatedAt: 0, // treat cached copies as stale so counts refresh
  });
}

export const flattenPages = (data: { pages: FeedPost[][] } | undefined) => data?.pages.flat() ?? [];
