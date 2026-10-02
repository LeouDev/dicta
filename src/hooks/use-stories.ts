import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { toast } from '@/components/toast';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { cleanUpExpiredStories, deleteStory, fetchStories, fetchStoryTray, fetchStoryViewers, markStoryViewed } from '@/services/stories';
import { selectUserId, useAuth } from '@/store/auth';
import type { Story, StoryRing } from '@/types/models';

/** The rings at the top of Home. */
export function useStoryTray() {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.storyTray(userId), queryFn: fetchStoryTray, enabled: userId !== null, staleTime: 30_000 });
}

/** Someone's live stories, in the order they play. */
export function useStories(authorId: string) {
  const userId = useAuth(selectUserId);
  return useQuery({ queryKey: queryKeys.stories(authorId), queryFn: () => fetchStories(authorId, userId!), enabled: userId !== null });
}

/** Marks a story seen once it's shown, and drops the ring's "unseen" once all of theirs are. */
export function useMarkStoryViewed() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: (story: Story) => markStoryViewed(story.id, userId!),
    onMutate: (story) => {
      const stories = client.setQueryData<Story[]>(queryKeys.stories(story.authorId), (list) =>
        list?.map((s) => (s.id === story.id ? { ...s, viewedByMe: true } : s)),
      );
      if (stories?.every((s) => s.viewedByMe)) {
        client.setQueryData<StoryRing[]>(queryKeys.storyTray(userId), (rings) =>
          rings?.map((r) => (r.author.id === story.authorId ? { ...r, unseen: false } : r)),
        );
      }
    },
  });
}

export function useStoryViewers(storyId: string | null) {
  return useQuery({ queryKey: queryKeys.storyViewers(storyId ?? ''), queryFn: () => fetchStoryViewers(storyId!), enabled: storyId !== null });
}

export function useDeleteStory() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    mutationFn: deleteStory,
    onSuccess: (_data, story) => {
      client.setQueryData<Story[]>(queryKeys.stories(userId!), (list) => list?.filter((s) => s.id !== story.id));
      client.invalidateQueries({ queryKey: queryKeys.storyTray(userId) });
      toast('Story deleted');
    },
    onError: (error) => toast(friendlyError(error, 'Couldn’t delete the story.')),
  });
}

/** Once per launch: delete your expired stories and their photos (quietly; it retries next time). */
export function useExpiredStoryCleanup() {
  const userId = useAuth(selectUserId);
  useEffect(() => {
    if (userId) cleanUpExpiredStories(userId).catch(() => {});
  }, [userId]);
}
