import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

import type { CommentItem, FeedPost, ProfileView } from '@/types/models';

type Guard<V> = (value: unknown) => value is V;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isInfinite = (v: unknown): v is InfiniteData<unknown> => isObject(v) && Array.isArray(v.pages);

export const isPost: Guard<FeedPost> = (v): v is FeedPost => isObject(v) && 'design' in v && 'author' in v && 'likedByMe' in v;
export const isComment: Guard<CommentItem> = (v): v is CommentItem => isObject(v) && 'body' in v && 'parentId' in v;
export const isProfile: Guard<ProfileView> = (v): v is ProfileView => isObject(v) && 'username' in v && 'followers_count' in v;

/**
 * Maps every item matching `guard` inside any cached shape: a single item, a
 * list, or infinite-query pages. Unchanged branches keep their reference, so
 * memoized cards that didn't change never re-render.
 */
export function mapCached<T, V>(data: T, guard: Guard<V>, map: (item: V) => V | null): T {
  if (guard(data)) return (map(data) ?? data) as T;
  if (Array.isArray(data)) {
    let changed = false;
    const next: unknown[] = [];
    for (const item of data) {
      if (guard(item)) {
        const mapped = map(item);
        if (mapped === null) {
          changed = true;
          continue;
        }
        if (mapped !== item) changed = true;
        next.push(mapped);
      } else {
        const mapped = mapCached(item, guard, map);
        if (mapped !== item) changed = true;
        next.push(mapped);
      }
    }
    return (changed ? next : data) as T;
  }
  if (isInfinite(data)) {
    let changed = false;
    const pages = data.pages.map((page) => {
      const mapped = mapCached(page, guard, map);
      if (mapped !== page) changed = true;
      return mapped;
    });
    return (changed ? { ...data, pages } : data) as T;
  }
  return data;
}

function patchAll<V>(client: QueryClient, prefixes: QueryKey[], guard: Guard<V>, map: (item: V) => V | null) {
  for (const queryKey of prefixes) {
    client.setQueriesData({ queryKey }, (data: unknown) => mapCached(data, guard, map));
  }
}

/** Updates one post in every cached list and its detail view. */
export function patchPost(client: QueryClient, postId: string, update: (post: FeedPost) => FeedPost) {
  patchAll(client, [['posts'], ['post', postId]], isPost, (p) => (p.id === postId ? update(p) : p));
}

/** Removes a post from every cached list (e.g. after deleting or blocking). */
export function removePosts(client: QueryClient, shouldRemove: (post: FeedPost) => boolean) {
  patchAll(client, [['posts']], isPost, (p) => (shouldRemove(p) ? null : p));
}

/** A cached copy of a post, for instant detail screens. */
export function findPost(client: QueryClient, postId: string): FeedPost | undefined {
  let found: FeedPost | undefined;
  for (const [, data] of client.getQueriesData({ queryKey: ['posts'] })) {
    mapCached(data, isPost, (p) => {
      if (p.id === postId) found ??= p;
      return p;
    });
    if (found) break;
  }
  return found;
}

export function patchComment(client: QueryClient, commentId: string, update: (comment: CommentItem) => CommentItem | null) {
  patchAll(client, [['comments'], ['replies']], isComment, (c) => (c.id === commentId ? update(c) : c));
}

/** Updates a profile wherever it's cached: profile screens, creator lists, search. */
export function patchProfile(client: QueryClient, userId: string, update: (profile: ProfileView) => ProfileView) {
  patchAll(client, [['profile'], ['creators'], ['users']], isProfile, (p) => (p.id === userId ? update(p) : p));
}
