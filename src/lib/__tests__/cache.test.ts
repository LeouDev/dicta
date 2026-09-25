import { QueryClient, type InfiniteData } from '@tanstack/react-query';

import { withFollow, withLike } from '@/features/social/reducers';
import { author, comment, pages, post, profile } from '@/test-utils/fixtures';
import type { CommentItem, FeedPost, ProfileView } from '@/types/models';

import { findPost, isPost, mapCached, patchComment, patchPost, patchProfile, removePosts } from '../cache';
import { queryKeys } from '../query-keys';

const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
type Pages<T> = InfiniteData<T[]>;

describe('mapCached', () => {
  const a = post({ id: 'a' });
  const b = post({ id: 'b' });
  const likeA = (p: typeof a) => (p.id === 'a' ? withLike(p, true) : p);

  it('maps a single item, a list and infinite pages', () => {
    expect(mapCached(a, isPost, likeA).likedByMe).toBe(true);
    expect(mapCached([a, b], isPost, likeA)[0].likedByMe).toBe(true);
    expect(mapCached(pages([a], [b]), isPost, likeA).pages[0][0].likedByMe).toBe(true);
  });

  it('keeps references for anything that did not change', () => {
    const data = pages([a], [b]);
    const next = mapCached(data, isPost, likeA);
    expect(next).not.toBe(data);
    expect(next.pages[1]).toBe(data.pages[1]);
    expect(next.pages[1][0]).toBe(b);
    // Nothing matched: the very same object comes back.
    expect(mapCached(data, isPost, (p) => p)).toBe(data);
  });

  it('removes items when the map returns null', () => {
    expect(mapCached([a, b], isPost, (p) => (p.id === 'a' ? null : p))).toEqual([b]);
  });
});

describe('post cache', () => {
  it('patches one post in every feed, grid and its detail view', () => {
    const qc = client();
    qc.setQueryData(queryKeys.homeFeed('me'), pages([post({ id: 'p1' }), post({ id: 'p2' })]));
    qc.setQueryData(queryKeys.userPosts('u1'), pages([post({ id: 'p1' })]));
    qc.setQueryData(queryKeys.post('p1'), post({ id: 'p1' }));
    const untouched = qc.getQueryData(queryKeys.userPosts('u1'));

    patchPost(qc, 'p1', (p) => withLike(p, true));

    const home = qc.getQueryData<Pages<FeedPost>>(queryKeys.homeFeed('me'))!;
    expect(home.pages[0].map((p) => p.likedByMe)).toEqual([true, false]);
    expect(qc.getQueryData<FeedPost>(queryKeys.post('p1'))!.likeCount).toBe(1);
    expect(qc.getQueryData(queryKeys.userPosts('u1'))).not.toBe(untouched);

    patchPost(qc, 'p2', (p) => withLike(p, true));
    expect(qc.getQueryData<FeedPost>(queryKeys.post('p1'))!.likeCount).toBe(1);
  });

  it('removes a blocked author’s posts everywhere and finds cached posts', () => {
    const qc = client();
    qc.setQueryData(queryKeys.homeFeed('me'), pages([post({ id: 'p1', author: author('bad') }), post({ id: 'p2' })]));
    qc.setQueryData(queryKeys.trendingPosts(), pages([post({ id: 'p3', author: author('bad') })]));

    expect(findPost(qc, 'p3')?.id).toBe('p3');
    removePosts(qc, (p) => p.author.id === 'bad');

    expect(findPost(qc, 'p1')).toBeUndefined();
    expect(findPost(qc, 'p3')).toBeUndefined();
    expect(findPost(qc, 'p2')?.id).toBe('p2');
  });
});

describe('comment and profile cache', () => {
  it('patches and removes comments in threads and replies', () => {
    const qc = client();
    qc.setQueryData(queryKeys.comments('p1'), pages([comment({ id: 'c1' }), comment({ id: 'c2' })]));
    qc.setQueryData(queryKeys.replies('c1'), pages([comment({ id: 'r1', parentId: 'c1' })]));

    patchComment(qc, 'r1', (c) => ({ ...c, body: 'edited' }));
    patchComment(qc, 'c2', () => null);

    expect(qc.getQueryData<Pages<CommentItem>>(queryKeys.replies('c1'))!.pages[0][0].body).toBe('edited');
    expect(qc.getQueryData<Pages<CommentItem>>(queryKeys.comments('p1'))!.pages[0].map((c) => c.id)).toEqual(['c1']);
  });

  it('updates a profile on its screen, in creator lists and in search results', () => {
    const qc = client();
    qc.setQueryData(queryKeys.profileByUsername('ben'), profile());
    qc.setQueryData(queryKeys.suggestedCreators('me'), [profile(), profile({ id: 'u3', username: 'cy' })]);
    qc.setQueryData(queryKeys.searchUsers('be'), [profile()]);

    patchProfile(qc, 'u2', (p) => withFollow(p, true));

    expect(qc.getQueryData<ProfileView>(queryKeys.profileByUsername('ben'))).toMatchObject({ followed_by_me: true, followers_count: 1 });
    expect(qc.getQueryData<ProfileView[]>(queryKeys.suggestedCreators('me'))!.map((p) => p.followed_by_me)).toEqual([true, false]);
    expect(qc.getQueryData<ProfileView[]>(queryKeys.searchUsers('be'))![0].followed_by_me).toBe(true);
  });
});
