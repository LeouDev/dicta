import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { toast } from '@/components/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { radius, spacing } from '@/constants/tokens';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSearchUsers } from '@/hooks/use-discover';
import { useConversations } from '@/hooks/use-messages';
import { useTheme } from '@/hooks/use-theme';
import { queryKeys } from '@/lib/query-keys';
import { MIN_SEARCH_LENGTH } from '@/services/discover';
import { friendlyError } from '@/services/errors';
import { sendMessage, startConversation } from '@/services/messages';
import { selectUserId, useAuth } from '@/store/auth';
import { profileToAuthor, type PostAuthor } from '@/types/models';

/**
 * The /messages/new modal: pick someone to message. Opened with ?post=<id>
 * (Share → Send in Dicta), it sends them that quote and closes.
 */
export default function NewMessageScreen() {
  const { post } = useLocalSearchParams<{ post?: string }>();
  const theme = useTheme();
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim().replace(/^@+/, ''), 250);
  const searching = debounced.length >= MIN_SEARCH_LENGTH;
  const results = useSearchUsers(debounced, searching);
  const conversations = useConversations();
  const recent = (conversations.data ?? []).filter((c) => c.accepted).map((c) => c.other);
  const people: PostAuthor[] = searching ? (results.data ?? []).filter((p) => p.id !== userId).map(profileToAuthor) : recent;

  const choose = useMutation({
    mutationFn: async (person: PostAuthor) => {
      const conversationId = await startConversation(person.id);
      if (post) await sendMessage({ conversationId, senderId: userId!, postId: post });
      return { conversationId, person };
    },
    onSuccess: ({ conversationId, person }) => {
      client.invalidateQueries({ queryKey: queryKeys.conversations(userId) });
      if (post) {
        toast(`Sent to ${person.displayName}`);
        router.back();
      } else {
        router.replace(`/messages/${conversationId}`);
      }
    },
    onError: (error) => toast(friendlyError(error, post ? 'Couldn’t send the quote.' : 'Couldn’t open the chat.')),
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <Text variant="body" color="textSecondary">
            Cancel
          </Text>
        </Pressable>
        <Text variant="headline">{post ? 'Send to…' : 'New message'}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={[styles.search, { backgroundColor: theme.surface }]}>
        <Icon name="search" size={16} color={theme.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.accent}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search people"
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          !searching && recent.length > 0 ? (
            <Text variant="overline" color="textTertiary" style={styles.section}>
              Recent
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => choose.mutate(item)}
            disabled={choose.isPending}
            accessibilityRole="button"
            accessibilityLabel={`${post ? 'Send to' : 'Message'} ${item.displayName}, @${item.username}`}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.hairline }]}>
            <UserAvatar uri={item.avatarUrl} name={item.displayName} size={44} />
            <View style={styles.names}>
              <Text variant="callout" numberOfLines={1} style={styles.name}>
                {item.displayName}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
            {choose.isPending && choose.variables?.id === item.id && <ActivityIndicator color={theme.textTertiary} />}
          </Pressable>
        )}
        ListEmptyComponent={
          searching && results.isPending ? (
            <ActivityIndicator color={theme.textTertiary} style={styles.loading} />
          ) : (
            <Text variant="callout" color="textSecondary" style={styles.empty}>
              {searching ? 'No one by that name.' : 'Search for someone by name or @handle.'}
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  headerSpacer: { width: 52 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
  },
  searchInput: { flex: 1, fontSize: 16 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  names: { flex: 1 },
  name: { fontWeight: '600' },
  loading: { paddingVertical: spacing.xl },
  empty: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, textAlign: 'center' },
});
