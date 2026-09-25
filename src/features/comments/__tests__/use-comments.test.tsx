import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider, notifyManager, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { toast } from '@/components/toast';
import { queryKeys } from '@/lib/query-keys';
import { addComment, deleteComment } from '@/services/comments';
import { useAuth } from '@/store/auth';
import { author, comment, pages, post } from '@/test-utils/fixtures';
import type { CommentItem, FeedPost } from '@/types/models';

import { useAddComment, useDeleteComment } from '../use-comments';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } }, isSupabaseConfigured: true }));
jest.mock('@/services/profiles', () => ({ fetchProfile: jest.fn() }));
jest.mock('@/services/comments', () => ({
  addComment: jest.fn(),
  deleteComment: jest.fn(),
  fetchComments: jest.fn(),
  fetchReplies: jest.fn(),
  nextCommentCursor: () => undefined,
}));
jest.mock('@/services/social', () => ({ setCommentLike: jest.fn() }));
jest.mock('@/hooks/use-my-profile', () => ({
  useMyProfile: () => ({
    data: { id: 'me', username: 'me', display_name: 'Me', avatar_url: null, is_verified: false },
  }),
}));
jest.mock('@/components/toast', () => ({ toast: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'tmp' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), selectionAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

const addCommentMock = jest.mocked(addComment);
const deleteCommentMock = jest.mocked(deleteComment);

function setup(postComments: CommentItem[], commentCount = postComments.length) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  client.setQueryData(queryKeys.comments('p1'), pages(postComments));
  client.setQueryData(queryKeys.post('p1'), post({ commentCount }));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const thread = (client: QueryClient, key: readonly unknown[] = queryKeys.comments('p1')) =>
  client.getQueryData<InfiniteData<CommentItem[]>>(key)?.pages.flat() ?? [];
const commentCount = (client: QueryClient) => client.getQueryData<FeedPost>(queryKeys.post('p1'))!.commentCount;

// Deliver cache updates synchronously, inside act(), instead of on a timer.
notifyManager.setScheduler((callback) => callback());

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ session: { user: { id: 'me' } } as Session, initialized: true });
});

describe('useAddComment', () => {
  it('shows the comment at once, then swaps in the saved one', async () => {
    const { client, wrapper } = setup([comment({ id: 'c1' })]);
    let save = (_: CommentItem) => {};
    addCommentMock.mockReturnValue(new Promise((resolve) => (save = resolve)));

    const { result } = await renderHook(() => useAddComment('p1'), { wrapper });
    await act(() => result.current.mutate({ body: '  Lovely  ', parent: null }));

    await waitFor(() => expect(thread(client).map((c) => c.id)).toEqual(['c1', 'local-tmp']));
    expect(thread(client)[1]).toMatchObject({ body: 'Lovely', status: 'sending', author: { username: 'me' } });
    expect(commentCount(client)).toBe(2);

    await act(async () => save(comment({ id: 'c2', body: 'Lovely', author: author('me') })));
    expect(thread(client).map((c) => [c.id, c.status])).toEqual([
      ['c1', undefined],
      ['c2', undefined],
    ]);
  });

  it('puts a reply in its thread and counts it on the parent', async () => {
    const { client, wrapper } = setup([comment({ id: 'c1' })]);
    addCommentMock.mockResolvedValue(comment({ id: 'r1', parentId: 'c1', author: author('me') }));

    const { result } = await renderHook(() => useAddComment('p1'), { wrapper });
    await act(() => result.current.mutate({ body: '@user_u2 yes', parent: { id: 'c1' } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(addCommentMock).toHaveBeenCalledWith({ userId: 'me', postId: 'p1', parentId: 'c1', body: '@user_u2 yes' });
    expect(thread(client, queryKeys.replies('c1')).map((c) => c.id)).toEqual(['r1']);
    expect(thread(client)[0].replyCount).toBe(1);
    expect(commentCount(client)).toBe(2);
  });

  it('keeps a failed comment for a retry and stops counting it', async () => {
    const { client, wrapper } = setup([comment({ id: 'c1' })]);
    addCommentMock.mockRejectedValueOnce(new Error('offline'));

    const { result } = await renderHook(() => useAddComment('p1'), { wrapper });
    await act(() => result.current.mutate({ body: 'Hello', parent: null }));

    await waitFor(() => expect(thread(client).at(-1)?.status).toBe('failed'));
    expect(commentCount(client)).toBe(1);
    expect(toast).toHaveBeenCalled();

    addCommentMock.mockResolvedValueOnce(comment({ id: 'c9', body: 'Hello', author: author('me') }));
    await act(() => result.current.mutate({ body: 'Hello', parent: null, retryId: 'local-tmp' }));

    await waitFor(() => expect(thread(client).map((c) => c.id)).toEqual(['c1', 'c9']));
    expect(commentCount(client)).toBe(2);
  });
});

describe('useDeleteComment', () => {
  it('removes a comment with its replies and fixes the count', async () => {
    const { client, wrapper } = setup([comment({ id: 'c1', replyCount: 2 }), comment({ id: 'c2' })], 4);
    client.setQueryData(queryKeys.replies('c1'), pages([comment({ id: 'r1', parentId: 'c1' })]));
    deleteCommentMock.mockResolvedValue();

    const { result } = await renderHook(() => useDeleteComment('p1'), { wrapper });
    await act(() => result.current.mutate(thread(client)[0]));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteCommentMock).toHaveBeenCalledWith('c1');
    expect(thread(client).map((c) => c.id)).toEqual(['c2']);
    expect(client.getQueryData(queryKeys.replies('c1'))).toBeUndefined();
    expect(commentCount(client)).toBe(1);
  });

  it('removes a reply and updates its parent', async () => {
    const { client, wrapper } = setup([comment({ id: 'c1', replyCount: 1 })], 2);
    client.setQueryData(queryKeys.replies('c1'), pages([comment({ id: 'r1', parentId: 'c1' })]));
    deleteCommentMock.mockResolvedValue();

    const { result } = await renderHook(() => useDeleteComment('p1'), { wrapper });
    await act(() => result.current.mutate(thread(client, queryKeys.replies('c1'))[0]));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(thread(client, queryKeys.replies('c1'))).toEqual([]);
    expect(thread(client)[0].replyCount).toBe(0);
    expect(commentCount(client)).toBe(1);
  });

  it('discards a failed local comment without calling the server', async () => {
    const failed = comment({ id: 'local-x', status: 'failed' });
    const { client, wrapper } = setup([comment({ id: 'c1' }), failed], 1);

    const { result } = await renderHook(() => useDeleteComment('p1'), { wrapper });
    await act(() => result.current.mutate(failed));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteCommentMock).not.toHaveBeenCalled();
    expect(thread(client).map((c) => c.id)).toEqual(['c1']);
    expect(commentCount(client)).toBe(1);
  });
});
