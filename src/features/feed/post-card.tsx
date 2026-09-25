import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';
import { useLikePost } from '@/hooks/use-social';
import type { FeedPost } from '@/types/models';
import { timeAgo } from '@/utils/time';

import { LikeableCard } from './likeable-card';
import { PostActions } from './post-actions';

/** A post in the feed: the card is the content, the chrome stays quiet. */
export const PostCard = memo(function PostCard({ post, width }: { post: FeedPost; width: number }) {
  const like = useLikePost(post.id);

  return (
    <>
      <LikeableCard post={post} width={width} onLike={() => !post.likedByMe && like.mutate(true)} />
      <PostActions post={post} />
      <Pressable
        onPress={() => router.push(`/user/${post.author.username}`)}
        accessibilityRole="link"
        accessibilityLabel={`${post.author.displayName}, posted ${timeAgo(post.createdAt)} ago`}
        style={styles.meta}>
        <Text variant="subhead" numberOfLines={1} style={styles.name}>
          {post.author.displayName}
        </Text>
        <Text variant="caption" color="textTertiary">
          {timeAgo(post.createdAt)}
        </Text>
      </Pressable>
    </>
  );
});

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingBottom: spacing.xl, paddingHorizontal: spacing.xs, alignSelf: 'flex-start' },
  name: { flexShrink: 1 },
});
