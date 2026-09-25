import { router } from 'expo-router';
import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { hitTarget, spacing } from '@/constants/tokens';
import { openShare } from '@/features/share/share-sheet';
import { useLikePost, useSavePost } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import type { FeedPost } from '@/types/models';
import { compactNumber } from '@/utils/format';

import { usePostMenu } from './use-post-menu';

interface PostActionsProps {
  post: FeedPost;
  /** Called after the post is deleted from its own menu (e.g. to leave the post screen). */
  onDeleted?: () => void;
}

/** Like · comment · share on the left, save · more on the right. Quiet by design. */
export const PostActions = memo(function PostActions({ post, onDeleted }: PostActionsProps) {
  const theme = useTheme();
  const like = useLikePost(post.id);
  const save = useSavePost(post.id);
  const openMenu = usePostMenu();

  return (
    <View style={styles.row}>
      <HeartButton liked={post.likedByMe} count={post.likeCount} onPress={() => like.mutate(!post.likedByMe)} />
      <ActionButton
        icon="comment"
        count={post.commentCount}
        label={`Comments, ${post.commentCount}`}
        onPress={() => router.push(`/post/${post.id}/comments`)}
      />
      <ActionButton
        icon="share"
        label="Share"
        onPress={() => openShare({ text: post.text, design: post.design, author: post.author, postId: post.id })}
      />
      <View style={styles.spacer} />
      <ActionButton
        icon={post.savedByMe ? 'bookmark.fill' : 'bookmark'}
        label={post.savedByMe ? 'Saved' : 'Save'}
        selected={post.savedByMe}
        color={post.savedByMe ? theme.text : undefined}
        onPress={() => save.mutate(!post.savedByMe)}
      />
      <ActionButton icon="more" label="More options" onPress={() => openMenu(post, onDeleted)} />
    </View>
  );
});

function ActionButton({
  icon,
  label,
  count,
  color,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  count?: number;
  color?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={4}
      style={styles.button}>
      <Icon name={icon} size={21} color={color ?? theme.textSecondary} />
      {count !== undefined && count > 0 && (
        <Text variant="subhead" color="textSecondary" style={styles.count}>
          {compactNumber(count)}
        </Text>
      )}
    </Pressable>
  );
}

function HeartButton({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(liked);

  useEffect(() => {
    if (liked && !previous.current && !reduceMotion) {
      scale.set(withSequence(withSpring(1.28, { damping: 8, stiffness: 400 }), withSpring(1, { damping: 12, stiffness: 300 })));
    }
    previous.current = liked;
  }, [liked, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${liked ? 'Liked' : 'Like'}, ${count} ${count === 1 ? 'like' : 'likes'}`}
      accessibilityState={{ selected: liked }}
      hitSlop={4}
      style={styles.button}>
      <Animated.View style={style}>
        <Icon name={liked ? 'heart.fill' : 'heart'} size={22} color={liked ? theme.accent : theme.textSecondary} />
      </Animated.View>
      {count > 0 && (
        <Text variant="subhead" color={liked ? 'accent' : 'textSecondary'} style={styles.count}>
          {compactNumber(count)}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginHorizontal: -spacing.sm },
  button: {
    minWidth: hitTarget,
    height: hitTarget,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  count: { fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
});
