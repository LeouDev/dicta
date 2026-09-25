import type { InfiniteData } from '@tanstack/react-query';

import { createDesign } from '@/features/quote-card/templates';
import type { CommentItem, FeedPost, PostAuthor, ProfileView } from '@/types/models';

/** Small factories for social tests; override only what a test cares about. */

export const author = (id = 'u1'): PostAuthor => ({
  id,
  username: `user_${id}`,
  displayName: `User ${id}`,
  avatarUrl: null,
  isVerified: false,
});

export const post = (overrides: Partial<FeedPost> = {}): FeedPost => ({
  id: 'p1',
  text: 'Words that stay.',
  createdAt: '2026-09-25T10:00:00.000Z',
  topic: null,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  saveCount: 0,
  likedByMe: false,
  savedByMe: false,
  author: author(),
  design: createDesign('editorial'),
  ...overrides,
});

export const comment = (overrides: Partial<CommentItem> = {}): CommentItem => ({
  id: 'c1',
  postId: 'p1',
  parentId: null,
  body: 'Beautiful.',
  createdAt: '2026-09-25T10:05:00.000Z',
  likeCount: 0,
  replyCount: 0,
  likedByMe: false,
  author: author('u2'),
  ...overrides,
});

export const profile = (overrides: Partial<ProfileView> = {}): ProfileView => ({
  id: 'u2',
  username: 'ben',
  display_name: 'Ben',
  bio: '',
  avatar_url: null,
  cover_url: null,
  is_verified: false,
  followers_count: 0,
  following_count: 0,
  posts_count: 0,
  created_at: '2026-09-25T09:00:00.000Z',
  updated_at: '2026-09-25T09:00:00.000Z',
  followed_by_me: false,
  ...overrides,
});

/** One page of infinite-query data, the shape every feed is cached in. */
export const pages = <T,>(...items: T[][]): InfiniteData<T[]> => ({ pages: items, pageParams: items.map((_, i) => (i === 0 ? null : i)) });
