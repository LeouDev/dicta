import { memo } from 'react';
import { ActivityIndicator, Pressable, Text as RNText, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { hitTarget, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import type { CommentItem } from '@/types/models';
import { compactNumber } from '@/utils/format';
import { timeAgo } from '@/utils/time';

import { flattenComments, splitMentions } from './cache';
import { useCommentLike, useReplies } from './use-comments';

export interface CommentHandlers {
  onReply: (comment: CommentItem) => void;
  onMenu: (comment: CommentItem) => void;
  onRetry: (comment: CommentItem) => void;
  onOpenProfile: (username: string) => void;
}

const AVATAR = 34;
const REPLY_AVATAR = 26;

/** One comment: avatar, name, time, body with @mentions, Reply, and a small heart. */
export const CommentRow = memo(function CommentRow({ comment, handlers }: { comment: CommentItem; handlers: CommentHandlers }) {
  const theme = useTheme();
  const like = useCommentLike(comment.id);
  const isReply = comment.parentId !== null;
  const failed = comment.status === 'failed';
  const sent = comment.status === undefined;
  const toggleLike = () => like.mutate(!comment.likedByMe);
  const when = comment.status === 'sending' ? 'Posting…' : timeAgo(comment.createdAt);

  return (
    <Pressable
      onPress={failed ? () => handlers.onRetry(comment) : undefined}
      onLongPress={() => handlers.onMenu(comment)}
      accessible
      accessibilityLabel={`${comment.author.displayName}, ${when}. ${comment.body}${failed ? '. Not posted, double tap to retry' : ''}`}
      accessibilityActions={[
        ...(sent
          ? [
              { name: 'reply', label: 'Reply' },
              { name: 'like', label: comment.likedByMe ? 'Unlike' : 'Like' },
            ]
          : []),
        { name: 'profile', label: `View @${comment.author.username}` },
        { name: 'menu', label: 'More options' },
      ]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'reply') handlers.onReply(comment);
        if (nativeEvent.actionName === 'like') toggleLike();
        if (nativeEvent.actionName === 'profile') handlers.onOpenProfile(comment.author.username);
        if (nativeEvent.actionName === 'menu') handlers.onMenu(comment);
      }}
      style={[styles.row, isReply && styles.reply, comment.status === 'sending' && styles.sending]}>
      <Pressable onPress={() => handlers.onOpenProfile(comment.author.username)} hitSlop={4}>
        <UserAvatar uri={comment.author.avatarUrl} name={comment.author.displayName} size={isReply ? REPLY_AVATAR : AVATAR} />
      </Pressable>

      <View style={styles.body}>
        <Text variant="subhead" numberOfLines={1}>
          {comment.author.displayName}
          <RNText style={[styles.time, { color: theme.textTertiary }]}>{`  ${when}`}</RNText>
        </Text>
        <Text variant="callout">
          {splitMentions(comment.body).map((part, i) =>
            part.mention ? (
              <RNText key={i} style={{ color: theme.accent }} onPress={() => handlers.onOpenProfile(part.text.slice(1).toLowerCase())}>
                {part.text}
              </RNText>
            ) : (
              part.text
            ),
          )}
        </Text>
        {failed ? (
          <Text variant="caption" color="danger" style={styles.meta}>
            Couldn’t post. Tap to retry.
          </Text>
        ) : (
          sent && (
            <Pressable onPress={() => handlers.onReply(comment)} hitSlop={10} style={styles.meta}>
              <Text variant="caption" color="textSecondary">
                Reply
              </Text>
            </Pressable>
          )
        )}
      </View>

      {sent && (
        <Pressable onPress={toggleLike} hitSlop={6} style={styles.like}>
          <Icon
            name={comment.likedByMe ? 'heart.fill' : 'heart'}
            size={14}
            color={comment.likedByMe ? theme.accent : theme.textTertiary}
          />
          {comment.likeCount > 0 && (
            <Text variant="caption" color={comment.likedByMe ? 'accent' : 'textTertiary'} style={styles.count}>
              {compactNumber(comment.likeCount)}
            </Text>
          )}
        </Pressable>
      )}
    </Pressable>
  );
});

interface RepliesProps {
  parent: CommentItem;
  expanded: boolean;
  onToggle: () => void;
  handlers: CommentHandlers;
}

/** A comment's replies, indented under it and loaded on demand. */
export function Replies({ parent, expanded, onToggle, handlers }: RepliesProps) {
  const theme = useTheme();
  const replies = useReplies(parent.id, expanded);
  const items = expanded ? flattenComments(replies.data) : [];
  if (parent.replyCount === 0 && items.length === 0) return null;

  const count = parent.replyCount;
  return (
    <View>
      {items.map((reply) => (
        <CommentRow key={reply.id} comment={reply} handlers={handlers} />
      ))}
      {expanded && replies.isPending && <ActivityIndicator color={theme.textTertiary} style={styles.threadSpinner} />}
      {expanded && replies.isError && <ThreadButton label="Couldn’t load replies. Try again" onPress={() => replies.refetch()} />}
      {expanded && replies.hasNextPage && (
        <ThreadButton label="View more replies" onPress={() => !replies.isFetchingNextPage && replies.fetchNextPage()} />
      )}
      {count > 0 && (
        <ThreadButton label={expanded ? 'Hide replies' : `View ${count} ${count === 1 ? 'reply' : 'replies'}`} onPress={onToggle} />
      )}
    </View>
  );
}

function ThreadButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.thread}>
      <View style={[styles.threadLine, { backgroundColor: theme.textTertiary }]} />
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm + 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 },
  reply: { paddingLeft: spacing.lg + AVATAR + spacing.sm + 4 },
  sending: { opacity: 0.55 },
  body: { flex: 1, gap: 2 },
  time: { fontSize: 12, fontWeight: '400' },
  meta: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  like: { width: 32, minHeight: hitTarget - 8, alignItems: 'center', paddingTop: spacing.xs, gap: 2 },
  count: { fontVariant: ['tabular-nums'] },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
    paddingLeft: spacing.lg + AVATAR + spacing.sm + 4,
  },
  threadLine: { width: 24, height: StyleSheet.hairlineWidth * 2, opacity: 0.6 },
  threadSpinner: { paddingVertical: spacing.sm },
});
