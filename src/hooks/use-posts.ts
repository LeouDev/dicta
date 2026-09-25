import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { fetchHomeFeed, fetchUserPosts, nextCursor, type FeedCursor } from '@/services/posts';
import { selectUserId, useAuth } from '@/store/auth';

export function useHomeFeed() {
  const userId = useAuth(selectUserId);
  return useInfiniteQuery({
    queryKey: queryKeys.homeFeed(userId),
    queryFn: ({ pageParam }) => fetchHomeFeed(pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextCursor,
    enabled: userId !== null,
  });
}

export function useUserPosts(userId: string | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.userPosts(userId),
    queryFn: ({ pageParam }) => fetchUserPosts(userId!, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextCursor,
    enabled: userId !== null,
  });
}
