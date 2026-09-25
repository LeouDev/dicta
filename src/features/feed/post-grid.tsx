import { FlashList } from '@shopify/flash-list';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useState, type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { radius, spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';
import type { FeedPost } from '@/types/models';

import { CardSkeleton } from './card-skeleton';

export const GRID_GUTTER = spacing.md;
export const GRID_GAP = spacing.sm + 4;

interface PostGridProps {
  query: UseInfiniteQueryResult<InfiniteData<FeedPost[], unknown>>;
  header?: ReactElement | null;
  empty: ReactElement;
}

/**
 * The gallery view of posts: two-column masonry where every card keeps its own
 * format, with infinite scroll and pull to refresh. Tapping opens the post.
 */
export function PostGrid({ query, header, empty }: PostGridProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [pulling, setPulling] = useState(false);
  const items = dedupe(query.data?.pages.flat() ?? []);
  const tileWidth = (width - GRID_GUTTER * 2 - GRID_GAP) / 2;

  return (
    <FlashList
      data={items}
      masonry
      numColumns={2}
      keyExtractor={(post) => post.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <GridTile post={item} width={tileWidth} />}
      contentContainerStyle={styles.list}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      onEndReachedThreshold={0.8}
      refreshing={pulling}
      onRefresh={async () => {
        setPulling(true);
        await query.refetch();
        setPulling(false);
      }}
      ListEmptyComponent={
        query.isPending ? (
          <View style={styles.skeleton}>
            <CardSkeleton width={tileWidth * 2 + GRID_GAP} count={1} ratio={1.6} />
          </View>
        ) : query.isError ? (
          <EmptyState title="Couldn’t load these cards" message={friendlyError(query.error)} actionLabel="Try again" onAction={() => query.refetch()} />
        ) : (
          empty
        )
      }
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={theme.textTertiary} style={styles.more} /> : null}
    />
  );
}

export const GridTile = memo(function GridTile({ post, width }: { post: FeedPost; width: number }) {
  return (
    <View style={styles.tile}>
      <PressableScale
        onPress={() => router.push(`/post/${post.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${post.text.trim()} — by ${post.author.displayName}. Opens the post.`}
        scaleTo={0.98}>
        <QuoteCard text={post.text} design={post.design} author={post.author} width={width} radius={radius.md} />
      </PressableScale>
    </View>
  );
});

/** A post can land in two pages when new posts arrive between fetches. */
function dedupe(posts: FeedPost[]) {
  const seen = new Set<string>();
  return posts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

const styles = StyleSheet.create({
  // Masonry places items in whichever column is shorter, so tiles pad symmetrically.
  list: { paddingHorizontal: GRID_GUTTER - GRID_GAP / 2, paddingBottom: spacing.xxl },
  tile: { paddingHorizontal: GRID_GAP / 2, marginBottom: GRID_GAP },
  skeleton: { paddingHorizontal: GRID_GAP / 2 },
  more: { paddingVertical: spacing.lg },
});
