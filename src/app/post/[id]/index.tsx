import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { FollowButton } from '@/components/follow-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { radius, spacing } from '@/constants/tokens';
import { LikeableCard } from '@/features/feed/likeable-card';
import { PostActions } from '@/features/feed/post-actions';
import { useTopics } from '@/hooks/use-discover';
import { usePost } from '@/hooks/use-posts';
import { useProfileByUsername } from '@/hooks/use-profile';
import { useLikePost } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';
import { timeAgo } from '@/utils/time';

/** One quote, full width: author, the card, and everything you can do with it. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const post = usePost(id);
  const like = useLikePost(id);
  const author = useProfileByUsername(post.data?.author.username);
  const { data: topics } = useTopics();

  if (!post.data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {post.isPending ? (
          <ActivityIndicator color={theme.textTertiary} />
        ) : post.isError ? (
          <EmptyState title="Couldn’t load this quote" message={friendlyError(post.error)} actionLabel="Try again" onAction={() => post.refetch()} />
        ) : (
          <EmptyState title="This quote isn’t available" message="It may have been deleted." />
        )}
      </View>
    );
  }

  const p = post.data;
  const topic = topics?.find((t) => t.slug === p.topic);
  const openAuthor = () => router.push(`/user/${p.author.username}`);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.author}>
        <Pressable
          onPress={openAuthor}
          accessibilityRole="link"
          accessibilityLabel={`${p.author.displayName}, @${p.author.username}, posted ${timeAgo(p.createdAt)} ago`}
          style={styles.identity}>
          <UserAvatar uri={p.author.avatarUrl} name={p.author.displayName} size={40} />
          <View style={styles.names}>
            <View style={styles.nameRow}>
              <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                {p.author.displayName}
              </Text>
              {p.author.isVerified && <Icon name="verified" size={14} color={theme.accent} />}
            </View>
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              @{p.author.username} · {timeAgo(p.createdAt)}
            </Text>
          </View>
        </Pressable>
        {author.data && <FollowButton profile={author.data} size="sm" />}
      </View>

      <LikeableCard post={p} width={width - spacing.md * 2} onLike={() => !p.likedByMe && like.mutate(true)} />
      <PostActions post={p} onDeleted={() => router.back()} />

      <View style={styles.footer}>
        {topic && (
          <Pressable
            onPress={() => router.push(`/topic/${topic.slug}`)}
            accessibilityRole="link"
            accessibilityLabel={`Topic: ${topic.label}`}
            style={[styles.chip, { backgroundColor: theme.surface }]}>
            <Icon name="hashtag" size={12} color={theme.textSecondary} weight="semibold" />
            <Text variant="subhead" color="textSecondary">
              {topic.label}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.push(`/post/${p.id}/comments`)} accessibilityRole="button" hitSlop={8}>
          <Text variant="callout" color="textSecondary">
            {p.commentCount === 0
              ? 'Add a comment…'
              : `View ${p.commentCount === 1 ? '1 comment' : `all ${p.commentCount} comments`}`}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 4 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  names: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shrink: { flexShrink: 1 },
  footer: { gap: spacing.md, paddingHorizontal: spacing.xs, paddingTop: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    height: 30,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.pill,
  },
});
