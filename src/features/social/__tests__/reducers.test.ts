import { comment, post, profile } from '@/test-utils/fixtures';

import {
  canFollow,
  commentsRemovedBy,
  withCommentDelta,
  withCommentLike,
  withFollow,
  withFollowingDelta,
  withLike,
  withReplyDelta,
  withSave,
  withShare,
} from '../reducers';

describe('likes', () => {
  it('likes and unlikes, adjusting the count', () => {
    const liked = withLike(post({ likeCount: 4 }), true);
    expect(liked).toMatchObject({ likedByMe: true, likeCount: 5 });
    expect(withLike(liked, false)).toMatchObject({ likedByMe: false, likeCount: 4 });
  });

  it('ignores a duplicate like, so a double tap never double counts', () => {
    const liked = withLike(post({ likeCount: 4 }), true);
    expect(withLike(liked, true)).toBe(liked);
    expect(withLike(withLike(liked, true), true).likeCount).toBe(5);
  });

  it('never lets a count go negative', () => {
    expect(withLike(post({ likedByMe: true, likeCount: 0 }), false).likeCount).toBe(0);
  });

  it('works the same way for comment likes', () => {
    const liked = withCommentLike(comment(), true);
    expect(liked).toMatchObject({ likedByMe: true, likeCount: 1 });
    expect(withCommentLike(liked, true)).toBe(liked);
    expect(withCommentLike(liked, false).likeCount).toBe(0);
  });
});

describe('saves', () => {
  it('saves, ignores duplicates and unsaves', () => {
    const saved = withSave(post({ saveCount: 2 }), true);
    expect(saved).toMatchObject({ savedByMe: true, saveCount: 3 });
    expect(withSave(saved, true)).toBe(saved);
    expect(withSave(saved, false)).toMatchObject({ savedByMe: false, saveCount: 2 });
  });
});

describe('follows', () => {
  it('follows and unfollows, updating their follower count', () => {
    const followed = withFollow(profile({ followers_count: 9 }), true);
    expect(followed).toMatchObject({ followed_by_me: true, followers_count: 10 });
    expect(withFollow(followed, true)).toBe(followed);
    expect(withFollow(followed, false)).toMatchObject({ followed_by_me: false, followers_count: 9 });
  });

  it('updates the viewer’s following count', () => {
    expect(withFollowingDelta({ following_count: 3 }, 1).following_count).toBe(4);
    expect(withFollowingDelta({ following_count: 0 }, -1).following_count).toBe(0);
  });

  it('never allows following yourself (or following while signed out)', () => {
    expect(canFollow('u1', 'u1')).toBe(false);
    expect(canFollow(null, 'u2')).toBe(false);
    expect(canFollow('u1', 'u2')).toBe(true);
  });
});

describe('comments and shares', () => {
  it('adjusts the comment count and clamps at zero', () => {
    expect(withCommentDelta(post({ commentCount: 2 }), 1).commentCount).toBe(3);
    expect(withCommentDelta(post({ commentCount: 2 }), -5).commentCount).toBe(0);
    const p = post();
    expect(withCommentDelta(p, 0)).toBe(p);
  });

  it('counts replies that go with a deleted top-level comment', () => {
    expect(commentsRemovedBy(comment({ replyCount: 2 }))).toBe(3);
    expect(commentsRemovedBy(comment({ parentId: 'c0', replyCount: 0 }))).toBe(1);
  });

  it('tracks replies on the parent', () => {
    expect(withReplyDelta(comment({ replyCount: 1 }), 1).replyCount).toBe(2);
    expect(withReplyDelta(comment({ replyCount: 0 }), -1).replyCount).toBe(0);
  });

  it('counts a share', () => {
    expect(withShare(post({ shareCount: 7 })).shareCount).toBe(8);
  });
});
