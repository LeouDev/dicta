import type { StyleProp, ViewStyle } from 'react-native';

import { canFollow } from '@/features/social/reducers';
import { useFollow } from '@/hooks/use-social';
import { selectUserId, useAuth } from '@/store/auth';
import type { ProfileView } from '@/types/models';

import { Button } from './ui/button';

interface FollowButtonProps {
  profile: Pick<ProfileView, 'id' | 'username' | 'followed_by_me'>;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
}

/** Follow / Following, updated optimistically. Never shown on your own profile. */
export function FollowButton({ profile, size = 'md', style }: FollowButtonProps) {
  const userId = useAuth(selectUserId);
  const follow = useFollow(profile.id);
  if (!canFollow(userId, profile.id)) return null;

  const following = profile.followed_by_me;
  return (
    <Button
      label={following ? 'Following' : 'Follow'}
      variant={following ? 'secondary' : 'primary'}
      size={size}
      onPress={() => follow.mutate(!following)}
      accessibilityHint={following ? `Unfollows @${profile.username}` : `Follows @${profile.username}`}
      style={[{ minWidth: size === 'sm' ? 96 : 132 }, style]}
    />
  );
}
