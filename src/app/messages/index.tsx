import { Stack, router } from 'expo-router';
import { memo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { useConversationActions, useConversations } from '@/hooks/use-messages';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { confirm, showActions } from '@/lib/action-sheet';
import { friendlyError } from '@/services/errors';
import { messagePreview } from '@/services/messages';
import { selectUserId, useAuth } from '@/store/auth';
import type { Conversation } from '@/types/models';
import { timeAgo } from '@/utils/time';

type Tab = 'chats' | 'requests';

/** Your chats, and requests from people you don't follow. */
export default function MessagesScreen() {
  const theme = useTheme();
  const conversations = useConversations();
  const [tab, setTab] = useState<Tab>('chats');
  const all = conversations.data ?? [];
  const requests = all.filter((c) => !c.accepted);
  const shown = tab === 'chats' ? all.filter((c) => c.accepted) : requests;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/messages/new')}
              accessibilityRole="button"
              accessibilityLabel="New message"
              hitSlop={8}
              style={styles.headerButton}>
              <Icon name="pencil" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.tabs, { borderBottomColor: theme.hairline }]} accessibilityRole="tablist">
        {(['chats', 'requests'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[styles.tab, { borderBottomColor: tab === t ? theme.text : 'transparent' }]}>
            <Text variant="subhead" color={tab === t ? 'text' : 'textTertiary'}>
              {t === 'chats' ? 'Chats' : `Requests${requests.length ? ` (${requests.length})` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        contentContainerStyle={styles.list}
        refreshing={false}
        onRefresh={() => conversations.refetch()}
        ListHeaderComponent={
          tab === 'requests' && requests.length > 0 ? (
            <Text variant="caption" color="textSecondary" style={styles.note}>
              Messages from people you don’t follow. They won’t know you’ve seen them until you accept.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          conversations.isPending ? (
            <ActivityIndicator color={theme.textTertiary} style={styles.loading} />
          ) : conversations.isError ? (
            <EmptyState title="Couldn’t load messages" message={friendlyError(conversations.error)} actionLabel="Try again" onAction={() => conversations.refetch()} />
          ) : tab === 'chats' ? (
            <EmptyState
              title="No messages yet"
              message="Start a chat from someone’s profile, or send a quote from its Share menu."
              actionLabel="New message"
              onAction={() => router.push('/messages/new')}
            />
          ) : (
            <EmptyState title="No requests" message="Messages from people you don’t follow wait here until you accept them." />
          )
        }
      />
    </View>
  );
}

const ConversationRow = memo(function ConversationRow({ conversation: c }: { conversation: Conversation }) {
  const theme = useTheme();
  const userId = useAuth(selectUserId);
  const now = useNow();
  const actions = useConversationActions(c.id);
  const preview = messagePreview(c.last, userId ?? '');

  const openMenu = () =>
    showActions([
      { label: c.muted ? 'Unmute' : 'Mute', onPress: () => actions.mute.mutate(!c.muted) },
      {
        label: 'Delete chat',
        destructive: true,
        onPress: () =>
          confirm('Delete this chat?', 'It’s removed for you only. It comes back if they message you again.', 'Delete', () => actions.clear.mutate()),
      },
    ]);

  return (
    <Pressable
      onPress={() => router.push(`/messages/${c.id}`)}
      onLongPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel={`${c.unread ? 'Unread. ' : ''}${c.other.displayName}: ${preview}, ${timeAgo(c.last.createdAt, now)}${c.muted ? ', muted' : ''}`}
      accessibilityHint="Opens the chat. Press and hold for more options."
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.hairline }]}>
      <UserAvatar uri={c.other.avatarUrl} name={c.other.displayName} size={52} />
      <View style={styles.texts}>
        <View style={styles.nameRow}>
          <Text variant="callout" numberOfLines={1} style={[styles.name, c.unread && styles.strong]}>
            {c.other.displayName}
          </Text>
          {c.other.isVerified && <Icon name="verified" size={13} color={theme.accent} />}
          {c.muted && <Icon name="mute" size={13} color={theme.textTertiary} />}
        </View>
        <Text variant="subhead" color={c.unread ? 'text' : 'textSecondary'} numberOfLines={1} style={c.unread && styles.strong}>
          {preview} · {timeAgo(c.last.createdAt, now)}
        </Text>
      </View>
      {c.unread && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerButton: { width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: hitTarget, borderBottomWidth: 1.5, marginBottom: -StyleSheet.hairlineWidth },
  list: { flexGrow: 1, paddingVertical: spacing.sm },
  note: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  loading: { paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.sm },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flexShrink: 1 },
  strong: { fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
