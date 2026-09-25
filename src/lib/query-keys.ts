export const queryKeys = {
  profile: (userId: string | null) => ['profile', userId] as const,
  usernameAvailable: (username: string) => ['username-available', username] as const,
  homeFeed: (userId: string | null) => ['feed', 'home', userId] as const,
  userPosts: (userId: string | null) => ['posts', userId] as const,
};
