import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';

import { toast } from '@/components/toast';
import { commentsRemovedBy, withCommentDelta, withCommentLike, withReplyDelta } from '@/features/social/reducers';
import { useMyProfile } from '@/hooks/use-my-profile';
import { patchComment, patchPost } from '@/lib/cache';
import { queryKeys } from '@/lib/query-keys';
import { addComment, deleteComment, fetchComments, fetchReplies, nextCommentCursor } from '@/services/comments';
import { friendlyError } from '@/services/errors';
import type { FeedCursor } from '@/services/posts';
import { setCommentLike } from '@/services/social';
import { selectUserId, useAuth } from '@/store/auth';
import type { CommentItem } from '@/types/models';
import { profileToAuthor } from '@/types/models';

import { appendComment, type CommentPages } from './cache';

export function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.comments(postId),
    queryFn: ({ pageParam }) => fetchComments(postId, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextCommentCursor,
  });
}

export function useReplies(parentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.replies(parentId),
    queryFn: ({ pageParam }) => fetchReplies(parentId, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextCommentCursor,
    enabled,
  });
}

interface NewComment {
  body: string;
  /** The top-level comment being replied to, if any. */
  parent: Pick<CommentItem, 'id'> | null;
  /** Retrying a failed comment reuses its local id. */
  retryId?: string;
}

/**
 * Posts a comment optimistically: it appears at once (marked "sending"), is
 * swapped for the saved row on success, and stays visible as "failed" with a
 * retry on error, so nothing the person typed is ever lost.
 */
export function useAddComment(postId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const { data: me } = useMyProfile();

  return useMutation({
    mutationFn: ({ body, parent }: NewComment) => addComment({ userId: userId!, postId, parentId: parent?.id ?? null, body }),
    onMutate: ({ body, parent, retryId }) => {
      const tempId = retryId ?? `local-${Crypto.randomUUID()}`;
      if (retryId) {
        patchComment(client, retryId, (c) => ({ ...c, status: 'sending' }));
      } else if (me) {
        const temp: CommentItem = {
          id: tempId,
          postId,
          parentId: parent?.id ?? null,
          body: body.trim(),
          createdAt: new Date().toISOString(),
          likeCount: 0,
          replyCount: 0,
          likedByMe: false,
          author: profileToAuthor(me),
          status: 'sending',
        };
        const key = parent ? queryKeys.replies(parent.id) : queryKeys.comments(postId);
        client.setQueryData<CommentPages>(key, (data) => appendComment(data, temp));
        if (parent) patchComment(client, parent.id, (c) => withReplyDelta(c, 1));
      }
      patchPost(client, postId, (p) => withCommentDelta(p, 1));
      return { tempId };
    },
    onSuccess: (saved, _vars, context) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      patchComment(client, context.tempId, () => saved);
    },
    onError: (error, _vars, context) => {
      if (context) patchComment(client, context.tempId, (c) => ({ ...c, status: 'failed' }));
      patchPost(client, postId, (p) => withCommentDelta(p, -1));
      toast(friendlyError(error, 'Your comment wasn’t posted. Tap it to retry.'));
    },
  });
}

/** Removes a comment you wrote (or one on your post); replies go with a top-level comment. */
export function useDeleteComment(postId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (comment: CommentItem) => (comment.status ? Promise.resolve() : deleteComment(comment.id)),
    onMutate: (comment) => {
      patchComment(client, comment.id, () => null);
      if (comment.parentId) patchComment(client, comment.parentId, (c) => withReplyDelta(c, -1));
      else client.removeQueries({ queryKey: queryKeys.replies(comment.id) });
      // Failed local comments were never counted.
      if (comment.status !== 'failed') patchPost(client, postId, (p) => withCommentDelta(p, -commentsRemovedBy(comment)));
    },
    onError: (error) => {
      toast(friendlyError(error, 'Couldn’t delete that comment.'));
      client.invalidateQueries({ queryKey: queryKeys.comments(postId) });
      client.invalidateQueries({ queryKey: queryKeys.post(postId) });
    },
  });
}

export function useCommentLike(commentId: string) {
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  return useMutation({
    scope: { id: `comment-like:${commentId}` },
    mutationFn: (liked: boolean) => setCommentLike(userId!, commentId, liked),
    onMutate: (liked) => {
      if (liked) Haptics.selectionAsync();
      patchComment(client, commentId, (c) => withCommentLike(c, liked));
    },
    onError: (error, liked) => {
      patchComment(client, commentId, (c) => withCommentLike(c, !liked));
      toast(friendlyError(error, 'Couldn’t update your like.'));
    },
  });
}
