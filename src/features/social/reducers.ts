/**
 * Pure state transitions for optimistic social updates. Each is idempotent:
 * applying the state a post is already in returns it unchanged, so a double
 * tap or a replayed event can never double-count.
 */
import type { CommentItem, FeedPost, ProfileView } from '@/types/models';

const bump = (count: number, delta: number) => Math.max(0, count + delta);

export function withLike(post: FeedPost, liked: boolean): FeedPost {
  if (post.likedByMe === liked) return post;
  return { ...post, likedByMe: liked, likeCount: bump(post.likeCount, liked ? 1 : -1) };
}

export function withSave(post: FeedPost, saved: boolean): FeedPost {
  if (post.savedByMe === saved) return post;
  return { ...post, savedByMe: saved, saveCount: bump(post.saveCount, saved ? 1 : -1) };
}

export function withCommentDelta(post: FeedPost, delta: number): FeedPost {
  return delta === 0 ? post : { ...post, commentCount: bump(post.commentCount, delta) };
}

export function withShare(post: FeedPost): FeedPost {
  return { ...post, shareCount: post.shareCount + 1 };
}

export function withCommentLike(comment: CommentItem, liked: boolean): CommentItem {
  if (comment.likedByMe === liked) return comment;
  return { ...comment, likedByMe: liked, likeCount: bump(comment.likeCount, liked ? 1 : -1) };
}

export function withReplyDelta(comment: CommentItem, delta: number): CommentItem {
  return { ...comment, replyCount: bump(comment.replyCount, delta) };
}

/** The followed person's side: their follower count and the viewer's relationship. */
export function withFollow(profile: ProfileView, following: boolean): ProfileView {
  if (profile.followed_by_me === following) return profile;
  return { ...profile, followed_by_me: following, followers_count: bump(profile.followers_count, following ? 1 : -1) };
}

/** The viewer's own side: how many people they follow. */
export function withFollowingDelta<P extends { following_count: number }>(profile: P, delta: number): P {
  return { ...profile, following_count: bump(profile.following_count, delta) };
}

export function canFollow(viewerId: string | null, targetId: string): boolean {
  return viewerId !== null && viewerId !== targetId;
}

/** A deleted top-level comment takes its replies with it. */
export const commentsRemovedBy = (comment: CommentItem) => 1 + (comment.parentId ? 0 : comment.replyCount);
