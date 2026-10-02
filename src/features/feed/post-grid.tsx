import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { InfiniteData, UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTabBarSpace } from '@/components/bottom-tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { radius, spacing } from '@/constants/tokens';
import { plainText } from '@/features/quote-card/flow';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { useTabScrollToTop } from '@/hooks/use-tab-scroll-top';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';
import type { FeedPost } from '@/types/models';

import { CardSkeleton } from './card-skeleton';

export const GRID_GUTTER = spacing.md;
export const GRID_GAP = spacing.sm + 4;

interface PostGridProps {
  query: UseInfiniteQueryResult<InfiniteData<FeedPost[], unknown>>;
  /** Shown first, badged with a pin (a profile's pinned posts); refreshed with the grid. */
  pinned?: UseQueryResult<FeedPost[]>;
  header?: ReactElement | null;
  empty: ReactElement;
}

/**
 * The gallery view of posts: two-column masonry where every card keeps its own
 * format, with infinite scroll and pull to refresh. Tapping opens the post.
 */
export function PostGrid({ query, pinned, header, empty }: PostGridProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [pulling, setPulling] = useState(false);
  const tabBarSpace = useTabBarSpace();
  const listRef = useRef<FlashListRef<FeedPost>>(null);
  useTabScrollToTop(listRef);
  const pinnedPosts = pinned?.data ?? [];
  const items = dedupe([...pinnedPosts, ...(query.data?.pages.flat() ?? [])]);
  // Only a profile's pinned row is badged: every post carries pinned_at, also in Discover and search.
  const pinnedIds = new Set(pinnedPosts.map((post) => post.id));
  const tileWidth = (width - GRID_GUTTER * 2 - GRID_GAP) / 2;

  return (
    <FlashList
      ref={listRef}
      data={items}
      masonry
      numColumns={2}
      keyExtractor={(post) => post.id}
      // New posts arrive at the top: show them rather than hold the old first post in place.
      maintainVisibleContentPosition={{ disabled: true }}
      ListHeaderComponent={header}
      renderItem={({ item }) => <GridTile post={item} width={tileWidth} pinned={pinnedIds.has(item.id)} />}
      contentContainerStyle={{ ...styles.list, paddingBottom: tabBarSpace + spacing.xxl }}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      onEndReachedThreshold={0.8}
      refreshing={pulling}
      onRefresh={async () => {
        setPulling(true);
        await Promise.all([query.refetch(), pinned?.refetch()]);
        setPulling(false);
      }}
      ListEmptyComponent={
        query.isPending && pinnedPosts.length === 0 ? (
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

export const GridTile = memo(function GridTile({ post, width, pinned = false }: { post: FeedPost; width: number; pinned?: boolean }) {
  const extra = [pinned && 'Pinned', post.cards.length > 0 && `${post.cards.length + 1} cards`].filter(Boolean).join(', ');
  return (
    <View style={styles.tile}>
      <PressableScale
        onPress={() => router.push(`/post/${post.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${extra ? `${extra}. ` : ''}${plainText(post.text, post.design).trim()} — by ${post.author.displayName}. Opens the post.`}
        scaleTo={0.98}>
        <QuoteCard text={post.text} design={post.design} author={post.author} width={width} radius={radius.md} />
        {(pinned || post.cards.length > 0) && (
          <View style={styles.badges} pointerEvents="none">
            {pinned && <Badge icon="pin.fill" />}
            {post.cards.length > 0 && <Badge icon="stack" />}
          </View>
        )}
      </PressableScale>
    </View>
  );
});

/** A small mark in the corner of a tile, readable on any card. */
function Badge({ icon }: { icon: 'pin.fill' | 'stack' }) {
  return (
    <View style={styles.badge}>
      <Icon name={icon} size={11} color="#FFFFFF" weight="semibold" />
    </View>
  );
}

/** A post can land in two pages when new posts arrive between fetches. */
function dedupe(posts: FeedPost[]) {
  const seen = new Set<string>();
  return posts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

const styles = StyleSheet.create({
  // Masonry places items in whichever column is shorter, so tiles pad symmetrically.
  list: { paddingHorizontal: GRID_GUTTER - GRID_GAP / 2, paddingBottom: spacing.xxl },
  tile: { paddingHorizontal: GRID_GAP / 2, marginBottom: GRID_GAP },
  badges: { position: 'absolute', top: spacing.sm, right: spacing.sm, flexDirection: 'row', gap: spacing.xs },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  skeleton: { paddingHorizontal: GRID_GAP / 2 },
  more: { paddingVertical: spacing.lg },
});
