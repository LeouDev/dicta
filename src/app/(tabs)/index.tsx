import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTabBarSpace } from '@/components/bottom-tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Wordmark } from '@/components/wordmark';
import { hitTarget, spacing } from '@/constants/tokens';
import { CardSkeleton } from '@/features/feed/card-skeleton';
import { PostCard } from '@/features/feed/post-card';
import { StoryTray } from '@/features/stories/story-tray';
import { useUnreadMessages } from '@/hooks/use-messages';
import { useHomeFeed } from '@/hooks/use-posts';
import { useTabScrollToTop } from '@/hooks/use-tab-scroll-top';
import { useTheme } from '@/hooks/use-theme';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { selectUserId, useAuth } from '@/store/auth';
import type { FeedPost } from '@/types/models';

export default function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = width - spacing.md * 2;
  const feed = useHomeFeed();
  const [pulling, setPulling] = useState(false);
  const tabBarSpace = useTabBarSpace();
  const listRef = useRef<FlashListRef<FeedPost>>(null);
  useTabScrollToTop(listRef);
  const posts = feed.data?.pages.flat() ?? [];
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const { unread, requests } = useUnreadMessages();

  const refresh = async () => {
    setPulling(true);
    await Promise.all([
      feed.refetch(),
      client.invalidateQueries({ queryKey: queryKeys.storyTray(userId) }),
      client.invalidateQueries({ queryKey: queryKeys.conversations(userId) }),
    ]);
    setPulling(false);
  };

  return (
    <Screen edges={['top']} contentStyle={styles.screen}>
      <View style={styles.header}>
        <ScreenHeader
          left={<Wordmark size={20} />}
          right={
            <Pressable
              onPress={() => router.push('/messages')}
              accessibilityRole="button"
              accessibilityLabel={`Messages${unread ? `, ${unread} unread` : ''}${requests ? `, ${requests} requests` : ''}`}
              style={styles.messages}>
              <Icon name="messages" size={22} color={theme.text} />
              {(unread > 0 || requests > 0) && (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text variant="caption" style={[styles.badgeText, { color: theme.onAccent }]} allowFontScaling={false}>
                    {unread > 0 ? (unread > 9 ? '9+' : String(unread)) : '•'}
                  </Text>
                </View>
              )}
            </Pressable>
          }
        />
      </View>

      {feed.isPending ? (
        <CardSkeleton width={cardWidth} />
      ) : feed.isError && posts.length === 0 ? (
        <EmptyState title="Couldn’t load your feed" message={friendlyError(feed.error)} actionLabel="Try again" onAction={() => feed.refetch()} />
      ) : (
        <FlashList
          ref={listRef}
          data={posts}
          keyExtractor={(post) => post.id}
          // New posts arrive at the top: show them rather than hold the old first post in place.
          maintainVisibleContentPosition={{ disabled: true }}
          renderItem={({ item }) => <PostCard post={item} width={cardWidth} />}
          ListHeaderComponent={<StoryTray />}
          contentContainerStyle={{ ...styles.list, paddingBottom: tabBarSpace + spacing.lg }}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.8}
          refreshing={pulling}
          onRefresh={refresh}
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyState
                title="Your feed is quiet"
                message="Follow people whose words move you, or turn your first thought into a card."
                actionLabel="Write something"
                onAction={() => router.push('/create')}
              />
            </View>
          }
          ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={theme.textTertiary} style={styles.more} /> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  header: { paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  empty: { paddingTop: spacing.xxxl * 2 },
  more: { paddingVertical: spacing.lg },
  messages: { width: hitTarget, height: hitTarget, alignItems: 'flex-end', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0 },
});
