import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { fetchProfile } from '@/services/profiles';
import { selectUserId, useAuth } from '@/store/auth';

export function useMyProfile() {
  const userId = useAuth(selectUserId);
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => fetchProfile(userId!),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  });
}
