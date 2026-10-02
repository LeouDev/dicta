import type { CardAuthor, QuoteDesign } from '@/features/quote-card/types';

import type { Tables } from './database';

export type Profile = Tables<'profiles'>;

/** Someone else's profile, with the viewer's relationship to it (following, or asked to follow a private account). */
export type ProfileView = Profile & { followed_by_me: boolean; requested_by_me: boolean };

export interface PostAuthor extends CardAuthor {
  id: string;
}

/** One card's words and design. A post's first card is the post itself; up to nine more stack behind it. */
export interface CardContent {
  text: string;
  design: QuoteDesign;
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
  /** The cards after the first, in order (none for a single card). */
  cards: CardContent[];
  /** When the author pinned it to the top of their profile. */
  pinnedAt: string | null;
  /** 'published' for everyone; the author also sees their 'archived' (and moderated) posts. */
  status: string;
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

export type NotificationType = 'follow' | 'like' | 'comment' | 'reply' | 'mention' | 'comment_like' | 'follow_request' | 'follow_accept';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  actor: PostAuthor;
  post: Pick<FeedPost, 'id' | 'text' | 'design' | 'author'> | null;
  comment: { id: string; body: string } | null;
}

/** Someone asking to follow your private account. */
export interface FollowRequest {
  requester: PostAuthor;
  createdAt: string;
}

/** A 24-hour story: a card, with when it expires. */
export interface Story {
  id: string;
  authorId: string;
  author: PostAuthor;
  text: string;
  design: QuoteDesign;
  createdAt: string;
  expiresAt: string;
  viewedByMe: boolean;
}

/** A ring at the top of Home: someone with a live story. */
export interface StoryRing {
  author: PostAuthor;
  latestAt: string;
  unseen: boolean;
}

/** A chat in Messages, with the other person and the last message you can see. */
export interface Conversation {
  id: string;
  /** False while it's a request: someone you don't follow wrote first. */
  accepted: boolean;
  muted: boolean;
  lastReadAt: string | null;
  other: PostAuthor;
  otherLastReadAt: string | null;
  last: { id: string; senderId: string; body: string | null; postId: string | null; storyId: string | null; createdAt: string };
  /** The last message is theirs and you haven't read it. */
  unread: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  /** A shared quote, when the viewer can see it (null if it was deleted or is private to them). */
  post: Pick<FeedPost, 'id' | 'text' | 'design' | 'author'> | null;
  postId: string | null;
  /** The story this replies to, while it's live. */
  story: Pick<Story, 'id' | 'text' | 'design'> | null;
  storyId: string | null;
  createdAt: string;
  /** Local only: optimistic messages before (or after failing) the insert. */
  status?: 'sending' | 'failed';
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
