import type { StyleProp, ViewStyle } from 'react-native';

import { canFollow } from '@/features/social/reducers';
import { useFollow, type FollowAction } from '@/hooks/use-social';
import { confirm } from '@/lib/action-sheet';
import { selectUserId, useAuth } from '@/store/auth';
import type { ProfileView } from '@/types/models';

import { Button } from './ui/button';

interface FollowButtonProps {
  profile: Pick<ProfileView, 'id' | 'username' | 'followed_by_me' | 'requested_by_me' | 'is_private'>;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
}

/**
 * Follow / Following, or for a private account Follow / Requested, updated
 * optimistically. Never shown on your own profile.
 */
export function FollowButton({ profile, size = 'md', style }: FollowButtonProps) {
  const userId = useAuth(selectUserId);
  const follow = useFollow(profile.id);
  if (!canFollow(userId, profile.id)) return null;

  const handle = `@${profile.username}`;
  const following = profile.followed_by_me;
  const requested = !following && profile.requested_by_me;
  const action: FollowAction = following ? 'unfollow' : requested ? 'unrequest' : profile.is_private ? 'request' : 'follow';
  const press = () =>
    following && profile.is_private
      ? confirm(`Unfollow ${handle}?`, 'Their account is private, so you’ll need to ask again to see their posts.', 'Unfollow', () => follow.mutate('unfollow'))
      : follow.mutate(action);

  return (
    <Button
      label={following ? 'Following' : requested ? 'Requested' : 'Follow'}
      variant={following || requested ? 'secondary' : 'primary'}
      size={size}
      onPress={press}
      accessibilityHint={
        following ? `Unfollows ${handle}` : requested ? `Withdraws your request to follow ${handle}` : profile.is_private ? `Asks ${handle} to let you follow them` : `Follows ${handle}`
      }
      style={[{ minWidth: size === 'sm' ? 96 : 132 }, style]}
    />
  );
}
