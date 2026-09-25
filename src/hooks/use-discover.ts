import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { MIN_SEARCH_LENGTH, fetchSuggestedCreators, fetchTopics, fetchTrendingTags, searchProfiles, searchTags } from '@/services/discover';
import { selectUserId, useAuth } from '@/store/auth';

const HOUR = 60 * 60_000;

export const useTopics = () => useQuery({ queryKey: queryKeys.topics(), queryFn: fetchTopics, staleTime: 24 * HOUR });

export const useTrendingTags = () => useQuery({ queryKey: queryKeys.trendingTags(), queryFn: fetchTrendingTags, staleTime: 5 * 60_000 });

export function useSuggestedCreators() {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.suggestedCreators(userId), queryFn: fetchSuggestedCreators, staleTime: 5 * 60_000 });
}

export const useSearchUsers = (query: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.searchUsers(query),
    queryFn: () => searchProfiles(query),
    enabled: enabled && query.length >= MIN_SEARCH_LENGTH,
    staleTime: 60_000,
  });

export const useSearchTags = (query: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.searchTags(query),
    queryFn: () => searchTags(query),
    enabled: enabled && query.length >= MIN_SEARCH_LENGTH,
    staleTime: 60_000,
  });
