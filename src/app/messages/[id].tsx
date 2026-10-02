import * as Clipboard from 'expo-clipboard';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { openReport } from '@/features/safety/report-sheet';
import {
  newMessageId,
  useChat,
  useConversationActions,
  useConversationRealtime,
  useMarkConversationRead,
  useMessages,
  useOtherLastRead,
  useSendMessage,
  useUnsendMessage,
} from '@/hooks/use-messages';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useNow } from '@/hooks/use-now';
import { useBlock } from '@/hooks/use-safety';
import { useTheme } from '@/hooks/use-theme';
import { confirm, showActions } from '@/lib/action-sheet';
import { friendlyError } from '@/services/errors';
import { MESSAGE_MAX_LENGTH } from '@/services/messages';
import { selectUserId, useAuth } from '@/store/auth';
import { profileToAuthor, type Message, type PostAuthor } from '@/types/models';
import { timeAgo } from '@/utils/time';

/** One conversation: newest at the bottom, live, with "Seen" under your last message once they've read it. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  const userId = useAuth(selectUserId);
  const chat = useChat(id);
  const messages = useMessages(id);
  const otherLastRead = useOtherLastRead(id).data ?? null;
  const send = useSendMessage(id);
  const unsend = useUnsendMessage(id);
  const markRead = useMarkConversationRead(id);
  const actions = useConversationActions(id);
  const block = useBlock();
  const [draft, setDraft] = useState('');
  const { data: myProfile } = useMyProfile();
  const me = myProfile ? profileToAuthor(myProfile) : undefined;
  useConversationRealtime(id);

  const list = messages.data?.pages.flat() ?? [];
  const other = chat.data?.other;
  const accepted = chat.data?.accepted ?? true;
  // Your newest message they've read, to mark "Seen".
  const seenId = otherLastRead ? list.find((m) => m.senderId === userId && !m.status && m.createdAt <= otherLastRead)?.id : undefined;
  const newestTheirs = list.find((m) => m.senderId !== userId)?.id;

  // Reading the chat marks it read (requests stay unread until accepted, so the sender can't tell).
  useFocusEffect(
    useCallback(() => {
      if (accepted) markRead.mutate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accepted, newestTheirs]),
  );

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send.mutate({ tempId: newMessageId(), body });
  };

  const openMenu = () => {
    if (!other) return;
    const handle = `@${other.username}`;
    showActions([
      { label: 'View profile', onPress: () => router.push(`/user/${other.username}`) },
      { label: chat.data?.muted ? 'Unmute' : 'Mute', onPress: () => actions.mute.mutate(!chat.data?.muted) },
      { label: `Report ${handle}`, onPress: () => openReport({ kind: 'user', id: other.id, label: handle }) },
      {
        label: `Block ${handle}`,
        destructive: true,
        onPress: () =>
          confirm(`Block ${handle}?`, 'Neither of you can message the other, and you won’t see each other’s posts.', 'Block', () => {
            block.mutate({ targetId: other.id, username: other.username, blocked: true });
            router.back();
          }),
      },
      {
        label: 'Delete chat',
        destructive: true,
        onPress: () =>
          confirm('Delete this chat?', 'It’s removed for you only. It comes back if they message you again.', 'Delete', () => {
            actions.clear.mutate();
            router.back();
          }),
      },
    ]);
  };

  const onMessageLongPress = (message: Message) => {
    const mine = message.senderId === userId;
    showActions([
      ...(message.body ? [{ label: 'Copy', onPress: () => Clipboard.setStringAsync(message.body!).then(() => toast('Copied')) }] : []),
      ...(mine
        ? [{ label: message.status ? 'Delete' : 'Unsend', destructive: true, onPress: () => unsend.mutate(message) }]
        : [
            {
              label: 'Report message',
              onPress: () => openReport({ kind: 'message', id: message.id, userId: message.senderId, label: 'this message' }),
            },
          ]),
    ]);
  };

  const retry = (message: Message) => {
    unsend.mutate(message);
    send.mutate({ tempId: newMessageId(), body: message.body, postId: message.postId, storyId: message.storyId });
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 44} style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerTitle: () => (other ? <ChatTitle person={other} /> : null),
          headerRight: () => (
            <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="Chat options" hitSlop={8} style={styles.headerButton}>
              <Icon name="more" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        inverted
        data={list}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => (
          <MessageRow
            message={item}
            mine={item.senderId === userId}
            // In an inverted list the next item is the older one: group runs from the same person.
            first={list[index + 1]?.senderId !== item.senderId}
            seen={item.id === seenId}
            // A story reply shows the story: theirs when you replied, yours when they did.
            storyAuthor={(item.senderId === userId ? other : me) ?? fallbackAuthor}
            other={other}
            onLongPress={onMessageLongPress}
            onRetry={retry}
          />
        )}
        contentContainerStyle={styles.list}
        onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && messages.fetchNextPage()}
        onEndReachedThreshold={0.4}
        keyboardDismissMode="interactive"
        ListFooterComponent={
          messages.isFetchingNextPage ? <ActivityIndicator color={theme.textTertiary} style={styles.loading} /> : other && <ChatStart person={other} />
        }
        ListEmptyComponent={
          messages.isPending ? (
            <ActivityIndicator color={theme.textTertiary} style={styles.loading} />
          ) : messages.isError ? (
            <EmptyState title="Couldn’t load this chat" message={friendlyError(messages.error)} actionLabel="Try again" onAction={() => messages.refetch()} />
          ) : null
        }
      />

      {!accepted && other ? (
        <View style={[styles.request, { borderTopColor: theme.hairline, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Text variant="callout" style={styles.requestText}>
            {other.displayName} wants to message you. Accept to reply; they won’t know you’ve seen this until you do.
          </Text>
          <View style={styles.requestButtons}>
            <Button label="Accept" size="sm" onPress={() => actions.accept.mutate()} style={styles.flex} />
            <Button
              label="Delete"
              variant="secondary"
              size="sm"
              onPress={() => {
                actions.clear.mutate();
                router.back();
              }}
              style={styles.flex}
            />
            <Button
              label="Block"
              variant="secondary"
              size="sm"
              onPress={() =>
                confirm(`Block @${other.username}?`, 'They won’t be able to message you.', 'Block', () => {
                  block.mutate({ targetId: other.id, username: other.username, blocked: true });
                  router.back();
                })
              }
              style={styles.flex}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.composer, { borderTopColor: theme.hairline, paddingBottom: keyboardUp ? spacing.sm : Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={theme.textTertiary}
            selectionColor={theme.accent}
            multiline
            maxLength={MESSAGE_MAX_LENGTH}
            accessibilityLabel="Message"
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.send, { backgroundColor: theme.accent, opacity: draft.trim() ? 1 : 0.35 }]}>
            <Icon name="send" size={18} color={theme.onAccent} weight="semibold" />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function ChatTitle({ person }: { person: PostAuthor }) {
  return (
    <Pressable
      onPress={() => router.push(`/user/${person.username}`)}
      accessibilityRole="link"
      accessibilityLabel={`${person.displayName}. Opens their profile`}
      style={styles.title}>
      <UserAvatar uri={person.avatarUrl} name={person.displayName} size={28} />
      <Text variant="headline" numberOfLines={1} style={styles.titleText}>
        {person.displayName}
      </Text>
    </Pressable>
  );
}

/** The top of the chat: who it's with. */
function ChatStart({ person }: { person: PostAuthor }) {
  return (
    <View style={styles.start}>
      <UserAvatar uri={person.avatarUrl} name={person.displayName} size={72} />
      <Text variant="headline">{person.displayName}</Text>
      <Text variant="subhead" color="textSecondary">
        @{person.username}
      </Text>
    </View>
  );
}

const MessageRow = memo(function MessageRow({
  message: m,
  mine,
  first,
  seen,
  storyAuthor,
  other,
  onLongPress,
  onRetry,
}: {
  message: Message;
  mine: boolean;
  first: boolean;
  seen: boolean;
  storyAuthor: PostAuthor;
  other: PostAuthor | undefined;
  onLongPress: (m: Message) => void;
  onRetry: (m: Message) => void;
}) {
  const theme = useTheme();
  const now = useNow();
  const failed = m.status === 'failed';

  return (
    <View style={[styles.message, mine ? styles.mine : styles.theirs, first && styles.groupStart]}>
      {m.storyId && (
        <View style={[styles.storyReply, mine && styles.alignEnd]}>
          <Text variant="caption" color="textTertiary">
            {mine ? 'You replied to their story' : 'Replied to your story'}
          </Text>
          {m.story ? (
            <QuoteCard text={m.story.text} design={m.story.design} author={storyAuthor} width={84} radius={radius.xs} />
          ) : (
            <Text variant="caption" color="textTertiary" style={styles.gone}>
              Story no longer available
            </Text>
          )}
        </View>
      )}
      {m.postId && (
        <Pressable
          onPress={() => m.post && router.push(`/post/${m.post.id}`)}
          onLongPress={() => onLongPress(m)}
          accessibilityRole="button"
          accessibilityLabel={m.post ? `Shared quote by ${m.post.author.displayName}. Opens it` : 'Quote unavailable'}>
          {m.post ? (
            <QuoteCard text={m.post.text} design={m.post.design} author={m.post.author} width={196} radius={radius.md} />
          ) : (
            <View style={[styles.bubble, { backgroundColor: theme.surface }]}>
              <Text variant="callout" color="textTertiary">
                {m.status ? 'Sending a quote…' : 'This quote isn’t available'}
              </Text>
            </View>
          )}
        </Pressable>
      )}
      {m.body && (
        <Pressable
          onPress={() => failed && onRetry(m)}
          onLongPress={() => onLongPress(m)}
          accessibilityRole={failed ? 'button' : 'text'}
          accessibilityLabel={`${mine ? 'You' : (other?.displayName ?? 'They')}: ${m.body}${failed ? '. Not sent. Tap to retry' : ''}`}
          style={[
            styles.bubble,
            mine ? { backgroundColor: theme.accent } : { backgroundColor: theme.surface },
            m.status === 'sending' && styles.sending,
          ]}>
          <Text variant="body" style={{ color: mine ? theme.onAccent : theme.text }}>
            {m.body}
          </Text>
        </Pressable>
      )}
      {failed ? (
        <Text variant="caption" color="danger">
          Not sent. Tap to retry
        </Text>
      ) : seen ? (
        <Text variant="caption" color="textTertiary">
          Seen
        </Text>
      ) : first && !m.status ? (
        <Text variant="caption" color="textTertiary">
          {timeAgo(m.createdAt, now)}
        </Text>
      ) : null}
    </View>
  );
});

const fallbackAuthor: PostAuthor = { id: '', displayName: '', username: '', avatarUrl: null, isVerified: false };

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  headerButton: { width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 240 },
  titleText: { flexShrink: 1 },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  loading: { paddingVertical: spacing.lg },
  start: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  message: { maxWidth: '78%', gap: 4, marginTop: 3 },
  groupStart: { marginTop: spacing.md },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  alignEnd: { alignItems: 'flex-end' },
  bubble: { borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sending: { opacity: 0.6 },
  storyReply: { gap: 4 },
  gone: { fontStyle: 'italic' },
  request: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  requestText: { textAlign: 'center' },
  requestButtons: { flexDirection: 'row', gap: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 10, fontSize: 16 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

/** Whether the keyboard is up: its height already covers the home indicator, so the composer drops that padding. */
function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const subscriptions = [Keyboard.addListener('keyboardWillShow', () => setUp(true)), Keyboard.addListener('keyboardWillHide', () => setUp(false))];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);
  return up;
}
