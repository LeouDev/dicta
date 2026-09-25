import type { CardAuthor, QuoteDesign } from '@/features/quote-card/types';

import type { Tables } from './database';

export type Profile = Tables<'profiles'>;

export interface FeedPost {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount: number;
  author: CardAuthor & { id: string };
  design: QuoteDesign;
}

export const profileToAuthor = (profile: Profile): CardAuthor => ({
  displayName: profile.display_name,
  username: profile.username,
  avatarUrl: profile.avatar_url,
  isVerified: profile.is_verified,
});
