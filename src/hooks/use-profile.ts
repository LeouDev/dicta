import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { fetchProfileByUsername } from '@/services/profiles';

/** Another person's profile (cached per handle), including whether you follow them. */
export function useProfileByUsername(username: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileByUsername(username ?? ''),
    queryFn: () => fetchProfileByUsername(username!),
    enabled: Boolean(username),
    staleTime: 60_000,
  });
}
