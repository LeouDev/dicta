export const queryKeys = {
  profile: (userId: string | null) => ['profile', userId] as const,
  usernameAvailable: (username: string) => ['username-available', username] as const,
};
