// /api/purge: drops a deleted post (or a deleted account's posts) from the cache, and nothing else.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { AUTHOR_ID, ORIGIN, POST_ID, fakeSupabase, post, purged } from './fake-supabase.mjs';

const { POST } = await import('../api/purge.js');

const purge = (query) => POST(new Request(`${ORIGIN}/api/purge?${query}`, { method: 'POST' }));

beforeEach(() => {
  purged.length = 0;
});

test('purges a post that’s gone', async () => {
  fakeSupabase({ posts: [] });
  assert.equal((await purge(`post=${POST_ID}`)).status, 204);
  assert.deepEqual(purged, [`post-${POST_ID}`]);
});

test('refuses to purge a post that’s still visible', async () => {
  fakeSupabase({ posts: [post()] });
  assert.equal((await purge(`post=${POST_ID}`)).status, 409);
  assert.deepEqual(purged, []);
});

test('purges every post of a deleted account, and only a deleted one', async () => {
  fakeSupabase({ posts: [], profiles: [] });
  assert.equal((await purge(`author=${AUTHOR_ID}`)).status, 204);
  assert.deepEqual(purged, [`author-${AUTHOR_ID}`]);

  purged.length = 0;
  fakeSupabase({ posts: [], profiles: [AUTHOR_ID] });
  assert.equal((await purge(`author=${AUTHOR_ID}`)).status, 409);
  assert.deepEqual(purged, []);
});

test('rejects anything else', async () => {
  fakeSupabase();
  assert.equal((await purge('post=nope')).status, 400);
  assert.equal((await purge('')).status, 400);
});
