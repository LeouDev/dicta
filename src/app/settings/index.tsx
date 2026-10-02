import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { clearDraftPhotos } from '@/features/composer/photo';
import { useComposer } from '@/features/composer/store';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useFollowRequests } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/action-sheet';
import { queryKeys } from '@/lib/query-keys';
import { deleteAccount } from '@/services/account';
import { signOut } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { setPrivateAccount } from '@/services/profiles';
import type { Profile } from '@/types/models';
import { selectUserId, useAuth } from '@/store/auth';

// The next person to sign in on this device shouldn't find your draft.
const clearDraft = () => {
  useComposer.getState().reset();
  clearDraftPhotos();
};

export default function SettingsScreen() {
  const theme = useTheme();
  const userId = useAuth(selectUserId);
  const { data: me } = useMyProfile();
  const client = useQueryClient();
  const requests = useFollowRequests(Boolean(me?.is_private));
  const privacy = useMutation({
    mutationFn: (isPrivate: boolean) => setPrivateAccount(userId!, isPrivate),
    onMutate: (isPrivate) => {
      Haptics.selectionAsync();
      client.setQueryData<Profile | null>(queryKeys.profile(userId), (p) => (p ? { ...p, is_private: isPrivate } : p));
    },
    onSuccess: (profile, isPrivate) => {
      client.setQueryData(queryKeys.profile(userId), profile);
      if (isPrivate) return;
      // Going public accepts everyone waiting, after the row above was read: new followers, no requests.
      client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      client.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      client.removeQueries({ queryKey: queryKeys.followRequests(userId) });
    },
    onError: (e, isPrivate) => {
      client.setQueryData<Profile | null>(queryKeys.profile(userId), (p) => (p ? { ...p, is_private: !isPrivate } : p));
      Alert.alert('Couldn’t change your privacy', friendlyError(e));
    },
  });
  // Going public lets everyone waiting in.
  const setPrivate = (isPrivate: boolean) =>
    isPrivate || !requests.data?.length
      ? privacy.mutate(isPrivate)
      : confirm('Make your account public?', 'Everyone waiting will start following you.', 'Make public', () => privacy.mutate(false));
  const remove = useMutation({
    mutationFn: () => deleteAccount(userId!),
    onSuccess: clearDraft,
    onError: (e) => Alert.alert('Couldn’t delete your account', friendlyError(e)),
  });

  const logOut = () =>
    confirm('Log out of Dicta?', 'You can sign back in anytime.', 'Log out', () =>
      signOut()
        .then(clearDraft)
        .catch((e) => Alert.alert('Couldn’t log out', friendlyError(e))),
    );

  const deleteMine = () =>
    confirm(
      'Delete your account?',
      'This permanently deletes your profile, quotes, comments, likes and followers. It can’t be undone.',
      'Delete account',
      () => remove.mutate(),
    );

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      {me && (
        <Group>
          <Pressable
            onPress={() => router.push('/settings/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel={`${me.display_name}, @${me.username}. Edit profile`}
            style={styles.me}>
            <UserAvatar uri={me.avatar_url} name={me.display_name} size={52} />
            <View style={styles.meText}>
              <Text variant="headline" numberOfLines={1}>
                {me.display_name}
              </Text>
              <Text variant="subhead" color="textSecondary" numberOfLines={1}>
                @{me.username}
              </Text>
            </View>
            <Icon name="chevron.right" size={14} color={theme.textTertiary} weight="semibold" />
          </Pressable>
        </Group>
      )}

      <Group title="Account">
        <Row icon="pencil" label="Edit profile" onPress={() => router.push('/settings/edit-profile')} />
        <Row icon="bell" label="Notifications" onPress={() => router.push('/settings/notifications')} divider />
        <Row icon="archive" label="Archive" onPress={() => router.push('/archive')} divider />
        <Row icon="blocked" label="Blocked accounts" onPress={() => router.push('/settings/blocked')} divider />
      </Group>

      <Group
        title="Privacy"
        footer={
          me?.is_private
            ? 'Only people you approve can see your quotes and stories. Your name, photo and bio stay visible.'
            : 'Anyone can see your quotes and stories, and follow you.'
        }>
        <SwitchRow icon="lock" label="Private account" value={me?.is_private ?? false} onChange={setPrivate} />
        {me?.is_private && (
          <Row
            icon="person.requests"
            label={`Follow requests${requests.data?.length ? ` (${requests.data.length})` : ''}`}
            onPress={() => router.push('/requests')}
            divider
          />
        )}
      </Group>

      <Group>
        <Row icon="signout" label="Log out" onPress={logOut} action />
      </Group>

      <Group footer="Deleting your account removes everything you’ve posted. Other people’s saves of your quotes disappear too.">
        <Row label="Delete account" danger action busy={remove.isPending} onPress={deleteMine} />
      </Group>
    </ScrollView>
  );
}

function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      {title && (
        <Text variant="overline" color="textTertiary" style={styles.groupTitle}>
          {title}
        </Text>
      )}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>{children}</View>
      {footer && (
        <Text variant="caption" color="textTertiary" style={styles.groupFooter}>
          {footer}
        </Text>
      )}
    </View>
  );
}

function SwitchRow({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (value: boolean) => void; icon?: IconName }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {icon && <Icon name={icon} size={18} color={theme.textSecondary} />}
      <Text variant="body" style={styles.rowLabel}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.accent }} accessibilityLabel={label} />
    </View>
  );
}

interface RowProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** Does something instead of opening a screen: no chevron. */
  action?: boolean;
  danger?: boolean;
  busy?: boolean;
  divider?: boolean;
}

function Row({ label, onPress, icon, action, danger, busy, divider }: RowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline },
        pressed && { backgroundColor: theme.hairline },
      ]}>
      {icon && <Icon name={icon} size={18} color={theme.textSecondary} />}
      <Text variant="body" color={danger ? 'danger' : 'text'} style={styles.rowLabel}>
        {label}
      </Text>
      {busy ? (
        <ActivityIndicator color={theme.textTertiary} />
      ) : (
        !action && <Icon name="chevron.right" size={14} color={theme.textTertiary} weight="semibold" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  group: { gap: spacing.sm },
  groupTitle: { paddingHorizontal: spacing.md },
  groupFooter: { paddingHorizontal: spacing.md },
  card: { borderRadius: radius.md, overflow: 'hidden' },
  me: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  meText: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, minHeight: hitTarget + 6, paddingHorizontal: spacing.md },
  rowLabel: { flex: 1 },
});
