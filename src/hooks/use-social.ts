import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { toast } from '@/components/toast';
import { withFollow, withFollowingDelta, withLike, withRequest, withSave, withShare } from '@/features/social/reducers';
import { patchPost, patchProfile } from '@/lib/cache';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { acceptFollowRequest, declineFollowRequest, recordShare, setFollow, setFollowRequest, setLike, setSave } from '@/services/social';
import { fetchFollowRequests } from '@/services/profiles';
import { selectUserId, useAuth } from '@/store/auth';
import type { Profile } from '@/types/models';

/*
 * Social mutations are optimistic and serialized per target (mutation
 * `scope`): taps update the UI instantly, requests run in order, and the last
 * tap wins. Failures roll the optimistic change back and say so quietly.
 */

export function useLikePost(postId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    scope: { id: `like:${postId}` },
    mutationFn: (liked: boolean) => setLike(userId!, postId, liked),
    onMutate: (liked) => {
      if (liked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      patchPost(client, postId, (p) => withLike(p, liked));
    },
    onError: (error, liked) => {
      patchPost(client, postId, (p) => withLike(p, !liked));
      toast(friendlyError(error, 'Couldn’t update your like.'));
    },
  });
}

export function useSavePost(postId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    scope: { id: `save:${postId}` },
    mutationFn: (saved: boolean) => setSave(userId!, postId, saved),
    onMutate: (saved) => {
      Haptics.selectionAsync();
      patchPost(client, postId, (p) => withSave(p, saved));
    },
    onSuccess: (_data, saved) => {
      toast(saved ? 'Saved to your collection' : 'Removed from saved');
      client.invalidateQueries({ queryKey: queryKeys.savedPosts(userId) });
    },
    onError: (error, saved) => {
      patchPost(client, postId, (p) => withSave(p, !saved));
      toast(friendlyError(error, 'Couldn’t update saved.'));
    },
  });
}

/** Follow or unfollow, or (for a private account) ask to follow or take the request back. */
export type FollowAction = 'follow' | 'unfollow' | 'request' | 'unrequest';

/** The opposite of each action, for rolling an optimistic change back. */
const UNDO: Record<FollowAction, FollowAction> = { follow: 'unfollow', unfollow: 'follow', request: 'unrequest', unrequest: 'request' };

export function useFollow(targetId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const patchMe = (delta: number) =>
    client.setQueryData<Profile | null>(queryKeys.profile(userId), (me) => (me ? withFollowingDelta(me, delta) : me));
  const apply = (action: FollowAction) => {
    if (action === 'follow' || action === 'unfollow') {
      patchProfile(client, targetId, (p) => withFollow(p, action === 'follow'));
      patchMe(action === 'follow' ? 1 : -1);
    } else {
      patchProfile(client, targetId, (p) => withRequest(p, action === 'request'));
    }
  };

  return useMutation({
    scope: { id: `follow:${targetId}` },
    mutationFn: (action: FollowAction) =>
      action === 'follow' || action === 'unfollow'
        ? setFollow(userId!, targetId, action === 'follow')
        : setFollowRequest(userId!, targetId, action === 'request'),
    onMutate: (action) => {
      Haptics.selectionAsync();
      apply(action);
    },
    onSuccess: (_data, action) => {
      // The home feed and the story rings now include (or drop) their posts and stories.
      client.invalidateQueries({ queryKey: queryKeys.homeFeed(userId) });
      client.invalidateQueries({ queryKey: queryKeys.storyTray(userId) });
      client.invalidateQueries({ queryKey: queryKeys.suggestedCreators(userId) });
      // Unfollowing a private account hides its posts again.
      if (action === 'unfollow') {
        client.invalidateQueries({ queryKey: queryKeys.userPosts(targetId) });
        client.invalidateQueries({ queryKey: queryKeys.pinnedPosts(targetId) });
      }
    },
    onError: (error, action) => {
      apply(UNDO[action]);
      toast(friendlyError(error, 'Couldn’t update follow.'));
      // They may have gone private or public since their profile loaded; the next tap then picks the right action.
      client.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/** People asking to follow your private account. */
export function useFollowRequests(enabled = true) {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.followRequests(userId), queryFn: () => fetchFollowRequests(userId!), enabled: enabled && userId !== null });
}

/** Accept or decline a follow request; it leaves the list at once. */
export function useAnswerFollowRequest() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: ({ requesterId, accept }: { requesterId: string; accept: boolean }) =>
      accept ? acceptFollowRequest(requesterId) : declineFollowRequest(userId!, requesterId),
    onMutate: ({ requesterId }) => {
      Haptics.selectionAsync();
      client.setQueryData<{ requester: { id: string } }[]>(queryKeys.followRequests(userId), (list) =>
        list?.filter((r) => r.requester.id !== requesterId),
      );
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.followRequests(userId) });
      client.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      client.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) });
      client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
    onError: (error) => toast(friendlyError(error, 'Couldn’t answer the request.')),
  });
}

/** Counts a share (image saved, shared or link copied) once it happened. */
export function useRecordShare(postId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => recordShare(postId!),
    onMutate: () => {
      if (postId) patchPost(client, postId, withShare);
    },
  });
}
