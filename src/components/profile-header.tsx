import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/types/models';
import { compactNumber } from '@/utils/format';

import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { UserAvatar } from './user-avatar';

const COVER_HEIGHT = 120;
const AVATAR = 84;
/** The page-colored ring that sets the photo off the cover. */
const RING = 3;

/**
 * The cover photo, then the profile photo with the stats beside it (as on
 * Instagram), then name, handle and bio. `actions` go below (Follow, Edit profile…).
 */
export function ProfileHeader({ profile, actions }: { profile: Profile; actions?: ReactNode }) {
  const theme = useTheme();
  const stats = [
    { label: 'Posts', value: profile.posts_count },
    { label: 'Followers', value: profile.followers_count },
    { label: 'Following', value: profile.following_count },
  ];

  return (
    <View>
      <View style={[styles.cover, { backgroundColor: theme.accentSoft }]}>
        {profile.cover_url && (
          <Image source={{ uri: profile.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />
        )}
      </View>
      <View style={styles.row}>
        <View style={[styles.ring, { backgroundColor: theme.background }]}>
          <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={AVATAR} />
        </View>
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat} accessible accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}`}>
              <Text variant="headline">{compactNumber(stat.value)}</Text>
              <Text variant="caption" color="textSecondary">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text variant="title" accessibilityRole="header">
            {profile.display_name}
          </Text>
          {profile.is_verified && (
            <View accessible accessibilityLabel="Verified">
              <Icon name="verified" size={18} color={theme.accent} />
            </View>
          )}
        </View>
        <Text variant="callout" color="textSecondary">
          @{profile.username}
        </Text>
        {profile.bio ? (
          <Text variant="body" style={styles.bio}>
            {profile.bio}
          </Text>
        ) : null}
      </View>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: COVER_HEIGHT, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: -(AVATAR / 2 + RING),
    paddingHorizontal: spacing.md,
  },
  ring: { padding: RING, borderRadius: radius.pill },
  // The stats sit beside the half of the photo below the cover.
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: AVATAR / 2 + RING,
    marginLeft: spacing.sm,
  },
  stat: { alignItems: 'center' },
  identity: { paddingHorizontal: spacing.md, marginTop: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bio: { marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
});
