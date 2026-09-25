import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { fetchNotifications, fetchUnreadCount, markRead, nextNotificationCursor } from '@/services/notifications';
import type { FeedCursor } from '@/services/posts';
import { selectUserId, useAuth } from '@/store/auth';
import type { NotificationItem } from '@/types/models';

type Pages = InfiniteData<NotificationItem[], FeedCursor | null>;

export function useNotifications() {
  const userId = useAuth(selectUserId);
  return useInfiniteQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextNotificationCursor,
    enabled: userId !== null,
  });
}

export function useUnreadCount() {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.unreadCount(userId), queryFn: fetchUnreadCount, enabled: userId !== null });
}

/** Marks some (or, with no ids, all) notifications read, optimistically. */
export function useMarkRead() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: (ids?: string[]) => markRead(ids),
    onMutate: (ids) => {
      const now = new Date().toISOString();
      const matches = (n: NotificationItem) => !n.readAt && (!ids || ids.includes(n.id));
      let marked = 0;
      client.setQueryData<Pages>(queryKeys.notifications(userId), (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) =>
                page.map((n) => {
                  if (!matches(n)) return n;
                  marked += 1;
                  return { ...n, readAt: now };
                }),
              ),
            }
          : data,
      );
      client.setQueryData<number>(queryKeys.unreadCount(userId), (count) => (ids ? Math.max(0, (count ?? 0) - marked) : 0));
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) }),
  });
}

/** Live Activity: new notifications refresh the list and the tab badge. */
export function useNotificationsRealtime() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        () => {
          client.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) });
          client.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [client, userId]);
}
