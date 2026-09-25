import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/toast';
import { openReport } from '@/features/safety/report-sheet';
import { openShare } from '@/features/share/share-sheet';
import { useBlock } from '@/hooks/use-safety';
import { confirm, showActions } from '@/lib/action-sheet';
import { removePosts } from '@/lib/cache';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { deletePost } from '@/services/posts';
import { selectUserId, useAuth } from '@/store/auth';
import type { FeedPost } from '@/types/models';

/** The "⋯" menu for a post: share; delete your own; report or block someone else's. */
export function usePostMenu() {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const block = useBlock();
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

  return (post: FeedPost, onDeleted?: () => void) => {
    const share = { label: 'Share', onPress: () => openShare({ text: post.text, design: post.design, author: post.author, postId: post.id }) };
    if (post.author.id === userId) {
      showActions([
        share,
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
