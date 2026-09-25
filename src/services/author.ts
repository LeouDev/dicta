import type { PostAuthor } from '@/types/models';

export const AUTHOR_SELECT = 'id, username, display_name, avatar_url, is_verified';

/** A profiles row → the author a card shows. The website's renderer (web/card) uses it too. */
export function toAuthor(row: Record<string, unknown>): PostAuthor {
  return {
    id: String(row.id),
    username: String(row.username ?? ''),
    displayName: String(row.display_name ?? ''),
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    isVerified: row.is_verified === true,
  };
}
