import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { toast } from '@/components/toast';
import { useComposer } from '@/features/composer/store';
import { openReport } from '@/features/safety/report-sheet';
import { openShare } from '@/features/share/share-sheet';
import { useBlock } from '@/hooks/use-safety';
import { confirm, showActions, type SheetAction } from '@/lib/action-sheet';
import { patchPost, removePosts } from '@/lib/cache';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { deletePost, setArchived, setPinned } from '@/services/posts';
import { selectUserId, useAuth } from '@/store/auth';
import type { FeedPost } from '@/types/models';

/**
 * The "⋯" menu for a post: share; pin, archive, edit or delete your own;
 * report or block someone else's.
 */
export function usePostMenu() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const block = useBlock();
  const refreshProfile = () => {
    client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    client.invalidateQueries({ queryKey: queryKeys.userPosts(userId) });
    client.invalidateQueries({ queryKey: queryKeys.pinnedPosts(userId) });
  };

  const remove = useMutation({
    mutationFn: deletePost,
    onSuccess: (_data, post) => {
      removePosts(client, (p) => p.id === post.id);
      client.removeQueries({ queryKey: queryKeys.post(post.id) });
      client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      toast('Post deleted');
    },
    onError: (error) => toast(friendlyError(error, 'Couldn’t delete the post.')),
  });

  const archive = useMutation({
    mutationFn: ({ post, archived }: { post: FeedPost; archived: boolean }) => setArchived(post.id, archived),
    onSuccess: (_data, { post, archived }) => {
      Haptics.selectionAsync();
      // Archived posts leave every list but the Archive; brought back, they return to the profile.
      if (archived) removePosts(client, (p) => p.id === post.id);
      else removePosts(client, (p) => p.id === post.id && p.status === 'archived');
      patchPost(client, post.id, (p) => ({ ...p, status: archived ? 'archived' : 'published', pinnedAt: archived ? null : p.pinnedAt }));
      client.invalidateQueries({ queryKey: queryKeys.archivedPosts(userId) });
      client.invalidateQueries({ queryKey: queryKeys.homeFeed(userId) });
      refreshProfile();
      toast(archived ? 'Archived. Only you can see it, in your Archive.' : 'Back on your profile');
    },
    onError: (error) => toast(friendlyError(error, 'Couldn’t update the post.')),
  });

  const pin = useMutation({
    mutationFn: ({ post, pinned }: { post: FeedPost; pinned: boolean }) => setPinned(post.id, pinned),
    onSuccess: (_data, { post, pinned }) => {
      Haptics.selectionAsync();
      patchPost(client, post.id, (p) => ({ ...p, pinnedAt: pinned ? (p.pinnedAt ?? new Date().toISOString()) : null }));
      refreshProfile();
      toast(pinned ? 'Pinned to the top of your profile' : 'Unpinned');
    },
    onError: (error) => toast(friendlyError(error, 'Couldn’t update the pin.')),
  });

  return (post: FeedPost, onDeleted?: () => void) => {
    const share: SheetAction = {
      label: 'Share',
      onPress: () => openShare({ text: post.text, design: post.design, author: post.author, postId: post.id }),
    };
    if (post.author.id === userId) {
      const archived = post.status === 'archived';
      // A post moderation hid or removed can only be unpinned, edited or deleted (the server refuses the rest).
      const published = post.status === 'published';
      showActions([
        ...(archived ? [] : [share]),
        ...(published || post.pinnedAt
          ? [{ label: post.pinnedAt ? 'Unpin from profile' : 'Pin to profile', onPress: () => pin.mutate({ post, pinned: !post.pinnedAt }) }]
          : []),
        ...(archived
          ? [{ label: 'Show on profile', onPress: () => archive.mutate({ post, archived: false }) }]
          : published
            ? [{ label: 'Archive', onPress: () => archive.mutate({ post, archived: true }) }]
            : []),
        {
          label: 'Edit post',
          onPress: () => {
            const composer = useComposer.getState();
            // One composer at a time: a story or another edit can be open under this screen (a banner opened it).
            if (composer.editing || composer.story) return toast('Finish what you’re writing first.');
            composer.startEdit(post);
            router.push('/create');
          },
        },
        {
          label: 'Delete post',
          destructive: true,
          onPress: () =>
            confirm('Delete this post?', 'It will disappear from your profile and everyone’s feeds.', 'Delete', () =>
              remove.mutate(post, { onSuccess: onDeleted }),
            ),
        },
      ]);
      return;
    }
    const handle = `@${post.author.username}`;
    showActions([
      share,
      { label: 'Report quote', onPress: () => openReport({ kind: 'post', id: post.id, label: 'this quote' }) },
      {
        label: `Block ${handle}`,
        destructive: true,
        onPress: () =>
          confirm(`Block ${handle}?`, 'You won’t see each other’s posts, and they can’t follow or comment on you.', 'Block', () =>
            block.mutate({ targetId: post.author.id, username: post.author.username, blocked: true }),
          ),
      },
    ]);
  };
}
