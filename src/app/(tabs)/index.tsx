import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Wordmark } from '@/components/wordmark';
import { spacing } from '@/constants/tokens';
import { CardSkeleton } from '@/features/feed/card-skeleton';
import { PostCard } from '@/features/feed/post-card';
import { useHomeFeed } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';

export default function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = width - spacing.md * 2;
  const feed = useHomeFeed();
  const [pulling, setPulling] = useState(false);
  const posts = feed.data?.pages.flat() ?? [];

  const refresh = async () => {
    setPulling(true);
    await feed.refetch();
    setPulling(false);
  };

  return (
    <Screen edges={['top']} contentStyle={styles.screen}>
      <View style={styles.header}>
        <ScreenHeader left={<Wordmark size={20} />} />
      </View>

      {feed.isPending ? (
        <CardSkeleton width={cardWidth} />
      ) : feed.isError && posts.length === 0 ? (
        <EmptyState title="Couldn’t load your feed" message={friendlyError(feed.error)} actionLabel="Try again" onAction={() => feed.refetch()} />
      ) : (
        <FlashList
          data={posts}
          keyExtractor={(post) => post.id}
          // New posts arrive at the top: show them rather than hold the old first post in place.
          maintainVisibleContentPosition={{ disabled: true }}
          renderItem={({ item }) => <PostCard post={item} width={cardWidth} />}
          contentContainerStyle={styles.list}
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
});
