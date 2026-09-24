import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/types/models';
import { compactNumber } from '@/utils/format';

import { Icon } from './ui/icon';
import { Text } from './ui/text';
import { UserAvatar } from './user-avatar';

export function ProfileHeader({ profile }: { profile: Profile }) {
  const theme = useTheme();
  const stats = [
    { label: 'Posts', value: profile.posts_count },
    { label: 'Followers', value: profile.followers_count },
    { label: 'Following', value: profile.following_count },
  ];

  return (
    <View style={styles.wrap}>
      <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={92} />
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text variant="title" align="center" accessibilityRole="header">
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
      </View>
      {profile.bio ? (
        <Text variant="body" align="center" style={styles.bio}>
          {profile.bio}
        </Text>
      ) : null}
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={styles.stat}
            accessible
            accessibilityLabel={`${stat.value} ${stat.label.toLowerCase()}`}>
            <Text variant="headline">{compactNumber(stat.value)}</Text>
            <Text variant="caption" color="textSecondary">
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  identity: { alignItems: 'center', gap: spacing.xxs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bio: { maxWidth: 320 },
  stats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs },
  stat: { alignItems: 'center', gap: spacing.xxs, minWidth: 64 },
});
