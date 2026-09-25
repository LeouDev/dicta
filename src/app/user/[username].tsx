import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FollowButton } from '@/components/follow-button';
import { ProfileHeader } from '@/components/profile-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { hitTarget, spacing } from '@/constants/tokens';
import { PostGrid } from '@/features/feed/post-grid';
import { openReport } from '@/features/safety/report-sheet';
import { useUserPosts } from '@/hooks/use-posts';
import { useProfileByUsername } from '@/hooks/use-profile';
import { useBlock, useIsBlocked } from '@/hooks/use-safety';
import { useTheme } from '@/hooks/use-theme';
import { confirm, showActions } from '@/lib/action-sheet';
import { friendlyError } from '@/services/errors';
import { selectUserId, useAuth } from '@/store/auth';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const theme = useTheme();
  const userId = useAuth(selectUserId);
  const profile = useProfileByUsername(username);
  const p = profile.data;
  const blocked = useIsBlocked(p?.id);
  const block = useBlock();
  const posts = useUserPosts(p && !blocked ? p.id : null);
  const isMe = p?.id === userId;

  const openMenu = () => {
    if (!p) return;
    const handle = `@${p.username}`;
    showActions([
      { label: `Report ${handle}`, onPress: () => openReport({ kind: 'user', id: p.id, label: handle }) },
      blocked
        ? { label: `Unblock ${handle}`, onPress: () => block.mutate({ targetId: p.id, username: p.username, blocked: false }) }
        : {
            label: `Block ${handle}`,
            destructive: true,
            onPress: () =>
              confirm(`Block ${handle}?`, 'You won’t see each other’s posts, and they can’t follow or comment on you.', 'Block', () =>
                block.mutate({ targetId: p.id, username: p.username, blocked: true }),
              ),
          },
    ]);
  };

  const options = (
    <Stack.Screen
      options={{
        title: p ? `@${p.username}` : '',
        headerRight:
          p && !isMe
            ? () => (
                <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="More options" hitSlop={8} style={styles.headerButton}>
                  <Icon name="more" size={22} color={theme.text} />
                </Pressable>
              )
            : undefined,
      }}
    />
  );

  if (!p) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {options}
        {profile.isPending ? (
          <ActivityIndicator color={theme.textTertiary} />
        ) : profile.isError ? (
          <EmptyState title="Couldn’t load this profile" message={friendlyError(profile.error)} actionLabel="Try again" onAction={() => profile.refetch()} />
        ) : (
          <EmptyState title="This account isn’t available" message={`There’s no one at @${username} right now.`} />
        )}
      </View>
    );
  }

  const actions = isMe ? (
    <Button label="Edit profile" variant="secondary" size="sm" onPress={() => router.push('/settings/edit-profile')} style={styles.action} />
  ) : blocked ? (
    <Button
      label="Unblock"
      variant="secondary"
      size="sm"
      loading={block.isPending}
      onPress={() => block.mutate({ targetId: p.id, username: p.username, blocked: false })}
      style={styles.action}
    />
  ) : (
    <FollowButton profile={p} size="sm" style={styles.action} />
  );
  const header = (
    <View style={styles.header}>
      <ProfileHeader profile={p} actions={actions} />
    </View>
  );

  if (blocked) {
    return (
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.blocked}>
        {options}
        {header}
        <EmptyState title={`You blocked @${p.username}`} message="Unblock them to see their quotes. They won’t be told either way." />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {options}
      <PostGrid
        query={posts}
        header={header}
        empty={<EmptyState title="No quotes yet" message={`When @${p.username} posts, their cards will gather here.`} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerButton: { width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center' },
  header: { paddingBottom: spacing.xl, paddingHorizontal: spacing.sm },
  action: { flex: 1 },
  blocked: { flexGrow: 1, paddingBottom: spacing.xxl },
});
