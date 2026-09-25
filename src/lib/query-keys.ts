/**
 * Every list of posts lives under ['posts', …] and a single post under
 * ['post', id], so post-cache.ts can patch one post everywhere it appears.
 */
export const queryKeys = {
  profile: (userId: string | null) => ['profile', userId] as const,
  profileByUsername: (username: string) => ['profile', 'username', username] as const,
  usernameAvailable: (username: string) => ['username-available', username] as const,

  homeFeed: (userId: string | null) => ['posts', 'home', userId] as const,
  userPosts: (userId: string | null) => ['posts', 'user', userId] as const,
  savedPosts: (userId: string | null) => ['posts', 'saved', userId] as const,
  trendingPosts: () => ['posts', 'trending'] as const,
  recentPosts: () => ['posts', 'recent'] as const,
  topicPosts: (slug: string) => ['posts', 'topic', slug] as const,
  tagPosts: (tag: string) => ['posts', 'tag', tag] as const,
  searchPosts: (query: string) => ['posts', 'search', query] as const,
  post: (id: string) => ['post', id] as const,

  comments: (postId: string) => ['comments', postId] as const,
  replies: (commentId: string) => ['replies', commentId] as const,

  notifications: (userId: string | null) => ['notifications', userId] as const,
  unreadCount: (userId: string | null) => ['notifications', 'unread', userId] as const,

  topics: () => ['topics'] as const,
  trendingTags: () => ['tags', 'trending'] as const,
  searchTags: (query: string) => ['tags', 'search', query] as const,
  suggestedCreators: (userId: string | null) => ['creators', userId] as const,
  searchUsers: (query: string) => ['users', 'search', query] as const,
  blocked: (userId: string | null) => ['blocked', userId] as const,
};
