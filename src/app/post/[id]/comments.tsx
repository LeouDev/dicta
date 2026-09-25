import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { radius, spacing, typography } from '@/constants/tokens';
import { flattenComments } from '@/features/comments/cache';
import { CommentRow, Replies, type CommentHandlers } from '@/features/comments/comment-row';
import { useAddComment, useComments, useDeleteComment } from '@/features/comments/use-comments';
import { openReport } from '@/features/safety/report-sheet';
import { useMyProfile } from '@/hooks/use-my-profile';
import { usePost } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';
import { confirm, showActions, type SheetAction } from '@/lib/action-sheet';
import { COMMENT_MAX_LENGTH } from '@/services/comments';
import { friendlyError } from '@/services/errors';
import { selectUserId, useAuth } from '@/store/auth';
import type { CommentItem } from '@/types/models';

const LEADING_MENTION = /^@[a-z0-9_.]+\s*/i;

/** The conversation under a quote, in a sheet that keeps the card visible behind it. */
export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useAuth(selectUserId);
  const { data: me } = useMyProfile();
  const { data: post } = usePost(id);
  const comments = useComments(id);
  const add = useAddComment(id);
  const remove = useDeleteComment(id);
  const items = flattenComments(comments.data);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ parent: CommentItem; username: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<CommentItem>>(null);
  const keyboard = useKeyboardOverlap();
  const body = draft.trim();

  const handlers: CommentHandlers = {
    onReply: (comment) => {
      // Replies stay one level deep: answering a reply joins its thread and mentions its author.
      const parent = comment.parentId ? (items.find((c) => c.id === comment.parentId) ?? comment) : comment;
      const mention = comment.author.id === userId ? '' : `@${comment.author.username} `;
      setReplyTo({ parent, username: comment.author.username });
      setExpanded((e) => ({ ...e, [parent.id]: true }));
      setDraft((d) => mention + d.replace(LEADING_MENTION, ''));
      inputRef.current?.focus();
    },
    onMenu: (comment) => {
      if (comment.status === 'sending') return;
      const mine = comment.author.id === userId;
      const actions: SheetAction[] = [];
      if (!comment.status) actions.push({ label: 'Reply', onPress: () => handlers.onReply(comment) });
      if (mine || post?.author.id === userId) {
        actions.push({
          label: 'Delete comment',
          destructive: true,
          onPress: () =>
            confirm(
              'Delete this comment?',
              !comment.parentId && comment.replyCount > 0 ? 'Its replies will be deleted too.' : 'This can’t be undone.',
              'Delete',
              () => remove.mutate(comment),
            ),
        });
      }
      if (!mine && !comment.status) {
        actions.push({ label: 'Report comment', onPress: () => openReport({ kind: 'comment', id: comment.id, label: 'this comment' }) });
      }
      showActions(actions);
    },
    onRetry: (comment) => add.mutate({ body: comment.body, parent: comment.parentId ? { id: comment.parentId } : null, retryId: comment.id }),
    // Profiles are pushed screens, so leave the sheet first.
    onOpenProfile: (username) => {
      router.back();
      router.push(`/user/${username}`);
    },
  };

  const cancelReply = () => {
    setReplyTo(null);
    setDraft((d) => d.replace(LEADING_MENTION, ''));
  };

  const send = () => {
    if (!body) return;
    add.mutate({ body, parent: replyTo?.parent ?? null });
    setDraft('');
    setReplyTo(null);
    if (!replyTo) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const count = post?.commentCount ?? 0;

  return (
    // Not collapsable: react-native-screens resizes a formSheet's first ScrollView to the whole
    // sheet, which would slide the list under the header. Keeping this wrapper hides the list from it.
    <View collapsable={false} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <Text variant="headline" accessibilityRole="header">
          Comments
        </Text>
        {count > 0 && (
          <Text variant="subhead" color="textTertiary">
            {count}
          </Text>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <View>
            <CommentRow comment={item} handlers={handlers} />
            <Replies
              parent={item}
              expanded={expanded[item.id] ?? false}
              onToggle={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
              handlers={handlers}
            />
          </View>
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onEndReached={() => comments.hasNextPage && !comments.isFetchingNextPage && comments.fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          comments.isPending ? (
            <ActivityIndicator color={theme.textTertiary} style={styles.loading} />
          ) : comments.isError ? (
            <EmptyState title="Couldn’t load comments" message={friendlyError(comments.error)} actionLabel="Try again" onAction={() => comments.refetch()} />
          ) : (
            <EmptyState title="No comments yet" message="Say what these words stirred in you." />
          )
        }
        ListFooterComponent={comments.isFetchingNextPage ? <ActivityIndicator color={theme.textTertiary} style={styles.loading} /> : null}
      />

      <View
        style={[
          styles.composer,
          { borderTopColor: theme.hairline, paddingBottom: keyboard === null ? Math.max(insets.bottom, spacing.sm) : keyboard + spacing.sm },
        ]}>
        {replyTo && (
          <View style={styles.replying}>
            <Text variant="caption" color="textSecondary">
              Replying to @{replyTo.username}
            </Text>
            <Pressable onPress={cancelReply} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel reply">
              <Icon name="close" size={12} color={theme.textSecondary} weight="semibold" />
            </Pressable>
          </View>
        )}
        <View style={styles.inputRow}>
          <UserAvatar uri={me?.avatar_url} name={me?.display_name} size={32} />
          <View style={[styles.field, { backgroundColor: theme.surface }]}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Add a comment…'}
              placeholderTextColor={theme.textTertiary}
              selectionColor={theme.accent}
              multiline
              maxLength={COMMENT_MAX_LENGTH}
              accessibilityLabel={replyTo ? `Reply to @${replyTo.username}` : 'Add a comment'}
              style={[styles.input, { color: theme.text }]}
            />
            <Pressable
              onPress={send}
              disabled={!body}
              accessibilityRole="button"
              accessibilityLabel={replyTo ? 'Post reply' : 'Post comment'}
              accessibilityState={{ disabled: !body }}
              style={[styles.send, { backgroundColor: body ? theme.accent : theme.hairline }]}>
              <Icon name="send" size={15} color={body ? theme.onAccent : theme.textTertiary} weight="bold" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * How far the keyboard covers the sheet (null while it's hidden). The sheet's bottom edge sits at
 * the bottom of the screen while the keyboard is up, so that's the keyboard's height. (Measuring
 * isn't an option: inside a native sheet, layout positions start at the sheet's top, not the screen's.)
 */
function useKeyboardOverlap() {
  const [overlap, setOverlap] = useState<number | null>(null);
  useEffect(() => {
    const apply = (next: number | null, e: KeyboardEvent) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(Math.max(e.duration || 0, 10), 'keyboard', 'opacity'));
      setOverlap(next);
    };
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', (e) => apply(e.endCoordinates.height, e)),
      Keyboard.addListener('keyboardWillHide', (e) => apply(null, e)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);
  return overlap;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { flexGrow: 1, paddingVertical: spacing.sm },
  loading: { paddingVertical: spacing.xl },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.xs },
  replying: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: radius.lg,
    paddingLeft: spacing.md,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 40,
  },
  input: { ...typography.callout, flex: 1, maxHeight: 120, paddingTop: 7, paddingBottom: 7 },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
