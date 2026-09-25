import { toComment, nextCommentCursor, COMMENT_PAGE } from '../comments';
import { parseSearch } from '../discover';
import { notificationMessage, toNotification } from '../notifications';
import { storagePath } from '../profiles';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const actor = { id: 'u2', username: 'ben', display_name: 'Ben', avatar_url: null, is_verified: false };

describe('notifications', () => {
  it('writes the sentence that follows the actor’s name', () => {
    expect(notificationMessage({ type: 'follow', comment: null })).toBe('started following you.');
    expect(notificationMessage({ type: 'like', comment: null })).toBe('liked your quote.');
    expect(notificationMessage({ type: 'comment_like', comment: null })).toBe('liked your comment.');
    expect(notificationMessage({ type: 'comment', comment: { id: 'c1', body: 'So   true' } })).toBe('commented: “So true”');
    expect(notificationMessage({ type: 'reply', comment: { id: 'c1', body: 'Yes' } })).toBe('replied to your comment: “Yes”');
    expect(notificationMessage({ type: 'mention', comment: { id: 'c1', body: '@ana look' } })).toBe('mentioned you: “@ana look”');
  });

  it('shortens long comments', () => {
    const message = notificationMessage({ type: 'comment', comment: { id: 'c1', body: 'x'.repeat(200) } });
    expect(message.length).toBeLessThan(80);
    expect(message.endsWith('…”')).toBe(true);
  });

  it('maps rows, keeping read state, and drops broken or unknown ones', () => {
    const row = { id: 'n1', type: 'like', read_at: null, created_at: '2026-09-25T10:00:00Z', actor, post: null, comment: null };
    expect(toNotification(row)).toMatchObject({ id: 'n1', type: 'like', readAt: null, actor: { username: 'ben', displayName: 'Ben' } });
    expect(toNotification({ ...row, read_at: '2026-09-25T11:00:00Z' })?.readAt).toBe('2026-09-25T11:00:00Z');
    expect(toNotification({ ...row, type: 'poke' })).toBeNull();
    expect(toNotification({ ...row, actor: null })).toBeNull();
  });
});

describe('search', () => {
  it('classifies #tags, @people and everything else', () => {
    expect(parseSearch('  #Healing ')).toEqual({ query: 'Healing', scope: 'tags' });
    expect(parseSearch('@mara')).toEqual({ query: 'mara', scope: 'people' });
    expect(parseSearch('light')).toEqual({ query: 'light', scope: 'all' });
  });
});

describe('comments', () => {
  const row = {
    id: 'c1',
    post_id: 'p1',
    parent_id: null,
    body: 'Lovely',
    created_at: '2026-09-25T10:00:00Z',
    like_count: 2,
    reply_count: 1,
    liked_by_me: true,
    author: actor,
  };

  it('maps rows and drops ones without an author', () => {
    expect(toComment(row)).toMatchObject({ id: 'c1', parentId: null, likeCount: 2, replyCount: 1, likedByMe: true });
    expect(toComment({ ...row, author: null })).toBeNull();
  });

  it('pages only while pages are full', () => {
    const page = Array.from({ length: COMMENT_PAGE }, (_, i) => toComment({ ...row, id: `c${i}` })!);
    expect(nextCommentCursor(page)).toEqual({ createdAt: row.created_at, id: `c${COMMENT_PAGE - 1}` });
    expect(nextCommentCursor(page.slice(1))).toBeUndefined();
  });
});

describe('storagePath', () => {
  it('extracts our own storage paths and ignores other URLs', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar-1.jpg?v=2';
    expect(storagePath('avatars', url)).toBe('u1/avatar-1.jpg');
    expect(storagePath('avatars', 'https://example.com/a.jpg')).toBeNull();
    expect(storagePath('avatars', null)).toBeNull();
  });
});
