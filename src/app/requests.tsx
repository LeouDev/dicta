import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { spacing } from '@/constants/tokens';
import { useAnswerFollowRequest, useFollowRequests } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';
import type { FollowRequest } from '@/types/models';

/** People asking to follow your private account: accept or delete each. */
export default function FollowRequestsScreen() {
  const theme = useTheme();
  const requests = useFollowRequests();
  const answer = useAnswerFollowRequest();

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      data={requests.data ?? []}
      keyExtractor={(r) => r.requester.id}
      refreshing={false}
      onRefresh={() => requests.refetch()}
      renderItem={({ item }) => (
        <RequestRow
          request={item}
          onAccept={() => answer.mutate({ requesterId: item.requester.id, accept: true })}
          onDecline={() => answer.mutate({ requesterId: item.requester.id, accept: false })}
        />
      )}
      ListEmptyComponent={
        requests.isPending ? (
          <ActivityIndicator color={theme.textTertiary} style={styles.loading} />
        ) : requests.isError ? (
          <EmptyState title="Couldn’t load requests" message={friendlyError(requests.error)} actionLabel="Try again" onAction={() => requests.refetch()} />
        ) : (
          <EmptyState title="No requests" message="When someone asks to follow your private account, you’ll see them here." />
        )
      }
    />
  );
}

function RequestRow({ request, onAccept, onDecline }: { request: FollowRequest; onAccept: () => void; onDecline: () => void }) {
  const { requester } = request;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push(`/user/${requester.username}`)}
        accessibilityRole="link"
        accessibilityLabel={`${requester.displayName}, @${requester.username}`}
        style={styles.person}>
        <UserAvatar uri={requester.avatarUrl} name={requester.displayName} size={44} />
        <View style={styles.names}>
          <Text variant="subhead" numberOfLines={1} style={styles.name}>
            {requester.displayName}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            @{requester.username}
          </Text>
        </View>
      </Pressable>
      <Button label="Accept" size="sm" onPress={onAccept} accessibilityHint={`Lets @${requester.username} follow you`} />
      <Button label="Delete" variant="secondary" size="sm" onPress={onDecline} accessibilityHint={`Declines @${requester.username}’s request`} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingVertical: spacing.sm },
  loading: { paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  names: { flex: 1 },
  name: { fontWeight: '600' },
});
