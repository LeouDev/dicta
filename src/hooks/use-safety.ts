import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/toast';
import { removePosts } from '@/lib/cache';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { fetchBlocked, setBlocked, submitReport, type ReportInput } from '@/services/safety';
import { selectUserId, useAuth } from '@/store/auth';

export function useBlocked() {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.blocked(userId), queryFn: () => fetchBlocked(userId!), enabled: userId !== null });
}

export function useIsBlocked(targetId: string | undefined) {
  const { data } = useBlocked();
  return targetId ? (data?.some((b) => b.profile.id === targetId) ?? false) : false;
}

/** Block or unblock; blocking hides their posts from every cached list right away. */
export function useBlock() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: ({ targetId, blocked }: { targetId: string; username: string; blocked: boolean }) =>
      setBlocked(userId!, targetId, blocked),
    onSuccess: (_data, { targetId, username, blocked }) => {
      if (blocked) removePosts(client, (p) => p.author.id === targetId);
      toast(blocked ? `Blocked @${username}` : `Unblocked @${username}`);
      // Feeds, discovery, activity and profiles all depend on who is blocked.
      for (const key of [['posts'], ['blocked'], ['creators'], ['users'], ['notifications'], ['comments'], ['profile']]) {
        client.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error) => toast(friendlyError(error, 'Couldn’t update block.')),
  });
}

export function useReport() {
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: (input: Omit<ReportInput, 'reporterId'>) => submitReport({ ...input, reporterId: userId! }),
    onSuccess: () => toast('Thanks. We’ll review this report.'),
    onError: (error) => toast(friendlyError(error, 'Couldn’t send the report.')),
  });
}
