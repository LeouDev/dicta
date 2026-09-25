import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider, notifyManager, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { toast } from '@/components/toast';
import { queryKeys } from '@/lib/query-keys';
import { markRead } from '@/services/notifications';
import { setFollow, setLike } from '@/services/social';
import { useAuth } from '@/store/auth';
import { author, pages, post, profile } from '@/test-utils/fixtures';
import type { FeedPost, NotificationItem, ProfileView } from '@/types/models';

import { useMarkRead } from '../use-notifications';
import { useFollow, useLikePost } from '../use-social';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: jest.fn() } }, isSupabaseConfigured: true }));
jest.mock('@/services/profiles', () => ({ fetchProfile: jest.fn() }));
jest.mock('@/services/social', () => ({ setLike: jest.fn(), setSave: jest.fn(), setFollow: jest.fn(), recordShare: jest.fn() }));
jest.mock('@/services/notifications', () => ({
  markRead: jest.fn(),
  fetchNotifications: jest.fn(),
  fetchUnreadCount: jest.fn(),
  nextNotificationCursor: () => undefined,
}));
jest.mock('@/components/toast', () => ({ toast: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const setLikeMock = jest.mocked(setLike);
const setFollowMock = jest.mocked(setFollow);
const markReadMock = jest.mocked(markRead);

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

const homeFeed = (client: QueryClient) => client.getQueryData<InfiniteData<FeedPost[]>>(queryKeys.homeFeed('me'))!.pages[0];

// Deliver cache updates synchronously, inside act(), instead of on a timer.
notifyManager.setScheduler((callback) => callback());

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.setState({ session: { user: { id: 'me' } } as Session, initialized: true });
});

describe('useLikePost', () => {
  it('shows the like before the server answers, and keeps it', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.homeFeed('me'), pages([post({ likeCount: 3 })]));
    let finish = () => {};
    setLikeMock.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));

    const { result } = await renderHook(() => useLikePost('p1'), { wrapper });
    await act(() => result.current.mutate(true));

    await waitFor(() => expect(homeFeed(client)[0]).toMatchObject({ likedByMe: true, likeCount: 4 }));
    expect(setLikeMock).toHaveBeenCalledWith('me', 'p1', true);
    await act(async () => finish());
    expect(homeFeed(client)[0].likeCount).toBe(4);
  });

  it('rolls back and says so when the like fails', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.homeFeed('me'), pages([post({ likeCount: 3 })]));
    setLikeMock.mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useLikePost('p1'), { wrapper });
    await act(() => result.current.mutate(true));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(homeFeed(client)[0]).toMatchObject({ likedByMe: false, likeCount: 3 });
  });

  it('never double counts rapid repeated likes', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.homeFeed('me'), pages([post({ likeCount: 3 })]));
    setLikeMock.mockResolvedValue();

    const { result } = await renderHook(() => useLikePost('p1'), { wrapper });
    await act(() => {
      result.current.mutate(true);
      result.current.mutate(true);
    });

    await waitFor(() => expect(setLikeMock).toHaveBeenCalledTimes(2));
    expect(homeFeed(client)[0].likeCount).toBe(4);
  });
});

describe('useFollow', () => {
  it('updates their followers and your following count at once', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.profileByUsername('ben'), profile());
    client.setQueryData(queryKeys.profile('me'), profile({ id: 'me', username: 'me' }));
    setFollowMock.mockResolvedValue();

    const { result } = await renderHook(() => useFollow('u2'), { wrapper });
    await act(() => result.current.mutate(true));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<ProfileView>(queryKeys.profileByUsername('ben'))).toMatchObject({ followed_by_me: true, followers_count: 1 });
    expect(client.getQueryData<ProfileView>(queryKeys.profile('me'))).toMatchObject({ following_count: 1, followed_by_me: false });
  });

  it('undoes both counts when the follow fails', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.profileByUsername('ben'), profile({ followers_count: 5 }));
    client.setQueryData(queryKeys.profile('me'), profile({ id: 'me', username: 'me', following_count: 2 }));
    setFollowMock.mockRejectedValue(new Error('blocked'));

    const { result } = await renderHook(() => useFollow('u2'), { wrapper });
    await act(() => result.current.mutate(true));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<ProfileView>(queryKeys.profileByUsername('ben'))).toMatchObject({ followed_by_me: false, followers_count: 5 });
    expect(client.getQueryData<ProfileView>(queryKeys.profile('me'))!.following_count).toBe(2);
  });
});

describe('useMarkRead', () => {
  const note = (id: string, readAt: string | null): NotificationItem => ({
    id,
    type: 'like',
    readAt,
    createdAt: '2026-09-25T10:00:00Z',
    actor: author('u2'),
    post: null,
    comment: null,
  });

  it('marks one or all notifications read and keeps the badge in step', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.notifications('me'), pages([note('n1', null), note('n2', null), note('n3', '2026-09-24T00:00:00Z')]));
    client.setQueryData(queryKeys.unreadCount('me'), 2);
    markReadMock.mockResolvedValue();
    const read = () => client.getQueryData<InfiniteData<NotificationItem[]>>(queryKeys.notifications('me'))!.pages[0].map((n) => n.readAt !== null);

    const { result } = await renderHook(() => useMarkRead(), { wrapper });
    await act(() => result.current.mutate(['n1']));
    await waitFor(() => expect(read()).toEqual([true, false, true]));
    expect(client.getQueryData(queryKeys.unreadCount('me'))).toBe(1);
    expect(markReadMock).toHaveBeenCalledWith(['n1']);

    await act(() => result.current.mutate(undefined));
    await waitFor(() => expect(read()).toEqual([true, true, true]));
    expect(client.getQueryData(queryKeys.unreadCount('me'))).toBe(0);
  });
});
