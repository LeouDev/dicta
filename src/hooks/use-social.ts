import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { toast } from '@/components/toast';
import { withFollow, withFollowingDelta, withLike, withSave, withShare } from '@/features/social/reducers';
import { patchPost, patchProfile } from '@/lib/cache';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { recordShare, setFollow, setLike, setSave } from '@/services/social';
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

export function useFollow(targetId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const patchMe = (delta: number) =>
    client.setQueryData<Profile | null>(queryKeys.profile(userId), (me) => (me ? withFollowingDelta(me, delta) : me));

  return useMutation({
    scope: { id: `follow:${targetId}` },
    mutationFn: (following: boolean) => setFollow(userId!, targetId, following),
    onMutate: (following) => {
      Haptics.selectionAsync();
      patchProfile(client, targetId, (p) => withFollow(p, following));
      patchMe(following ? 1 : -1);
    },
    onSuccess: () => {
      // The home feed now includes (or drops) their posts.
      client.invalidateQueries({ queryKey: queryKeys.homeFeed(userId) });
      client.invalidateQueries({ queryKey: queryKeys.suggestedCreators(userId) });
    },
    onError: (error, following) => {
      patchProfile(client, targetId, (p) => withFollow(p, !following));
      patchMe(following ? -1 : 1);
      toast(friendlyError(error, 'Couldn’t update follow.'));
    },
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
