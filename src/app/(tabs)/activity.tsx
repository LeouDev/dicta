import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useScrollToTop } from 'expo-router';
import { memo, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text as RNText, StyleSheet, View } from 'react-native';

import { useTabBarSpace } from '@/components/bottom-tab-bar';
import { PushPrompt } from '@/components/push-prompt';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { radius, spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useMarkRead, useNotifications, useUnreadCount } from '@/hooks/use-notifications';
import { useAnswerFollowRequest, useFollowRequests } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { notificationMessage } from '@/services/notifications';
import { selectUserId, useAuth } from '@/store/auth';
import type { NotificationItem } from '@/types/models';
import { useNow } from '@/hooks/use-now';
import { timeAgo } from '@/utils/time';

export default function ActivityScreen() {
  const theme = useTheme();
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const notifications = useNotifications();
  const unread = useUnreadCount().data ?? 0;
  const { mutate: markRead } = useMarkRead();
  const [pulling, setPulling] = useState(false);
  const tabBarSpace = useTabBarSpace();
  const listRef = useRef<FlatList<NotificationItem>>(null);
  useScrollToTop(listRef);
  const items = notifications.data?.pages.flat() ?? [];
  const { data: me } = useMyProfile();
  const requests = useFollowRequests(Boolean(me?.is_private));
  const waiting = requests.data?.length ?? 0;

  // Leaving Activity means you've seen it: clear the badge (rows stay tinted while you're here).
  useFocusEffect(
    useCallback(
      () => () => {
        if ((client.getQueryData<number>(queryKeys.unreadCount(userId)) ?? 0) > 0) markRead(undefined);
      },
      [client, userId, markRead],
    ),
  );

  const open = (n: NotificationItem) => {
    if (!n.readAt) markRead([n.id]);
    if (n.type === 'follow' || n.type === 'follow_request' || n.type === 'follow_accept' || !n.post) {
      return router.push(`/user/${n.actor.username}`);
    }
    router.push(`/post/${n.post.id}`);
    if (n.comment) router.push(`/post/${n.post.id}/comments`);
  };

  return (
    <Screen edges={['top']} contentStyle={styles.screen}>
      <View style={styles.header}>
        <ScreenHeader
          title="Activity"
          right={
            unread > 0 && (
              <Pressable onPress={() => markRead(undefined)} accessibilityRole="button" hitSlop={8}>
                <Text variant="subhead" color="accent">
                  Mark all read
                </Text>
              </Pressable>
            )
          }
        />
      </View>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow item={item} onPress={open} />}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace + spacing.xxl }]}
        refreshing={pulling}
        onRefresh={async () => {
          setPulling(true);
          await Promise.all([notifications.refetch(), me?.is_private ? requests.refetch() : null]);
          setPulling(false);
        }}
        onEndReached={() => notifications.hasNextPage && !notifications.isFetchingNextPage && notifications.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <PushPrompt />
            {waiting > 0 && (
              <Pressable
                onPress={() => router.push('/requests')}
                accessibilityRole="button"
                accessibilityLabel={`Follow requests, ${waiting} waiting`}
                style={({ pressed }) => [styles.requests, pressed && { opacity: 0.7 }]}>
                <View style={[styles.requestsIcon, { backgroundColor: theme.accentSoft }]}>
                  <Icon name="person.add" size={20} color={theme.accent} />
                </View>
                <View style={styles.text}>
                  <Text variant="callout" style={styles.name}>
                    Follow requests
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {waiting === 1 ? '1 person is waiting' : `${waiting} people are waiting`}
                  </Text>
                </View>
                <Icon name="chevron.right" size={14} color={theme.textTertiary} weight="semibold" />
              </Pressable>
            )}
          </>
        }
        ListEmptyComponent={
          notifications.isPending ? (
            <ActivityIndicator color={theme.textTertiary} style={styles.loading} />
          ) : notifications.isError ? (
            <EmptyState
              title="Couldn’t load activity"
              message={friendlyError(notifications.error)}
              actionLabel="Try again"
              onAction={() => notifications.refetch()}
            />
          ) : (
            <EmptyState title="No activity yet" message="When people follow you, love or comment on your cards, you’ll see it here." />
          )
        }
        ListFooterComponent={notifications.isFetchingNextPage ? <ActivityIndicator color={theme.textTertiary} style={styles.loading} /> : null}
      />
    </Screen>
  );
}

const NotificationRow = memo(function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: (n: NotificationItem) => void }) {
  const theme = useTheme();
  const unread = !item.readAt;
  const message = notificationMessage(item);
  const now = useNow();
  const when = timeAgo(item.createdAt, now);

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'New. ' : ''}${item.actor.displayName} ${message} ${when}`}
      style={({ pressed }) => [styles.row, unread && { backgroundColor: theme.accentSoft }, pressed && { opacity: 0.7 }]}>
      <View>
        <UserAvatar uri={item.actor.avatarUrl} name={item.actor.displayName} size={44} />
        {unread && <View style={[styles.dot, { backgroundColor: theme.accent, borderColor: theme.background }]} />}
      </View>
      <Text variant="callout" style={styles.text} numberOfLines={3}>
        <RNText style={styles.name}>{item.actor.displayName}</RNText> {message}
        <RNText style={{ color: theme.textTertiary }}>{`  ${when}`}</RNText>
      </Text>
      {item.type === 'follow_request' ? (
        <RequestButtons requesterId={item.actor.id} />
      ) : (
        item.post && <QuoteCard text={item.post.text} design={item.post.design} author={item.post.author} width={42} radius={radius.xs} />
      )}
    </Pressable>
  );
});

/** Accept or delete a follow request right from Activity. */
function RequestButtons({ requesterId }: { requesterId: string }) {
  const answer = useAnswerFollowRequest();
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const reply = (accept: boolean) =>
    answer.mutate({ requesterId, accept }, { onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications(userId) }) });
  return (
    <View style={styles.requestButtons}>
      <Button label="Accept" size="sm" onPress={() => reply(true)} />
      <Button label="Delete" variant="secondary" size="sm" onPress={() => reply(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  header: { paddingHorizontal: spacing.lg },
  list: { flexGrow: 1, paddingBottom: spacing.xxl },
  loading: { paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4 },
  dot: { position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  text: { flex: 1 },
  name: { fontWeight: '600' },
  requests: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4 },
  requestsIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  requestButtons: { flexDirection: 'row', gap: spacing.xs },
});
