import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { spacing } from '@/constants/tokens';
import { useBlock, useBlocked } from '@/hooks/use-safety';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';

export default function BlockedScreen() {
  const theme = useTheme();
  const blocked = useBlocked();
  const block = useBlock();

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      data={blocked.data ?? []}
      keyExtractor={(b) => b.profile.id}
      renderItem={({ item: { profile } }) => (
        <View style={styles.row}>
          <UserAvatar uri={profile.avatarUrl} name={profile.displayName} size={44} />
          <View style={styles.names}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {profile.displayName}
            </Text>
            <Text variant="subhead" color="textSecondary" numberOfLines={1}>
              @{profile.username}
            </Text>
          </View>
          <Button
            label="Unblock"
            variant="secondary"
            size="sm"
            accessibilityHint={`Unblocks @${profile.username}`}
            onPress={() => block.mutate({ targetId: profile.id, username: profile.username, blocked: false })}
          />
        </View>
      )}
      ListEmptyComponent={
        blocked.isPending ? null : blocked.isError ? (
          <EmptyState title="Couldn’t load blocked accounts" message={friendlyError(blocked.error)} actionLabel="Try again" onAction={() => blocked.refetch()} />
        ) : (
          <EmptyState title="No one is blocked" message="People you block can’t see your quotes, follow you or comment on your posts." />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  names: { flex: 1, gap: 1 },
});
