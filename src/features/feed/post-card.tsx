import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import type { FeedPost } from '@/types/models';
import { timeAgo } from '@/utils/time';

/** A post in the feed: the card is the content, the chrome stays quiet. */
export const PostCard = memo(function PostCard({ post, width }: { post: FeedPost; width: number }) {
  return (
    <View style={styles.wrap}>
      <QuoteCard text={post.text} design={post.design} author={post.author} width={width} />
      <View style={styles.meta}>
        <Text variant="subhead" numberOfLines={1} style={styles.name}>
          {post.author.displayName}
        </Text>
        <Text variant="caption" color="textTertiary">
          {timeAgo(post.createdAt)}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingBottom: spacing.xl },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingTop: spacing.sm + 4, paddingHorizontal: spacing.xs },
  name: { flexShrink: 1 },
});
