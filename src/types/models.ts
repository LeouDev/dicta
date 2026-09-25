import type { CardAuthor, QuoteDesign } from '@/features/quote-card/types';

import type { Tables } from './database';

export type Profile = Tables<'profiles'>;

/** Someone else's profile, with the viewer's relationship to it. */
export type ProfileView = Profile & { followed_by_me: boolean };

export interface PostAuthor extends CardAuthor {
  id: string;
}

export interface FeedPost {
  id: string;
  text: string;
  createdAt: string;
  topic: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  author: PostAuthor;
  design: QuoteDesign;
}

export interface CommentItem {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  author: PostAuthor;
  /** Local only: optimistic comments before (or after failing) the insert. */
  status?: 'sending' | 'failed';
}

export type NotificationType = 'follow' | 'like' | 'comment' | 'reply' | 'mention' | 'comment_like';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  actor: PostAuthor;
  post: Pick<FeedPost, 'id' | 'text' | 'design' | 'author'> | null;
  comment: { id: string; body: string } | null;
}

export interface Topic {
  slug: string;
  label: string;
}

export interface HashtagCount {
  tag: string;
  postCount: number;
}

export const profileToAuthor = (profile: Profile): PostAuthor => ({
  id: profile.id,
  displayName: profile.display_name,
  username: profile.username,
  avatarUrl: profile.avatar_url,
  isVerified: profile.is_verified,
});
