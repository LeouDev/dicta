// /card: each version of a post's artwork is drawn once, stored, and served from storage.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AUTHOR_ID, ORIGIN, POST_ID, fakeSupabase, post, settle, storageUrl } from './fake-supabase.mjs';

const { GET } = await import('../api/card.js');
const { cardImagePath, cardKey, previewImagePath } = await import('../lib/card-key.js');

const get = (query) => GET(new Request(`${ORIGIN}/api/card?${query}`));
const uploads = (db) => db.calls.filter((call) => call.startsWith('POST /storage/v1/object/generated-cards/')).length;
const paths = (row) => {
  const key = cardKey(row);
  return { card: cardImagePath(row, key), preview: previewImagePath(row, key) };
};

test('draws a missing card once, stores it, points the post at it and redirects there', async () => {
  const db = fakeSupabase();
  const { card } = paths(post());

  const first = await get(`id=${POST_ID}`);
  assert.equal(first.status, 302);
  assert.equal(first.headers.get('location'), storageUrl(`generated-cards/${card}`));
  assert.equal(db.posts.get(POST_ID).card_image_path, card);
  assert.ok(card.startsWith(`${AUTHOR_ID}/${POST_ID}-`));
  assert.ok(db.files.has(`generated-cards/${card}`));
  assert.equal(uploads(db), 1);

  const again = await get(`id=${POST_ID}`);
  assert.equal(again.status, 302);
  assert.equal(again.headers.get('location'), storageUrl(`generated-cards/${card}`));
  assert.equal(uploads(db), 1, 'served from storage, not drawn again');
});

test('draws the link preview once', async () => {
  const db = fakeSupabase();
  const { preview } = paths(post());

  const first = await get(`id=${POST_ID}&kind=og`);
  assert.equal(first.status, 302);
  assert.equal(first.headers.get('location'), storageUrl(`generated-cards/${preview}`));
  assert.ok(db.files.has(`generated-cards/${preview}`));

  await get(`id=${POST_ID}&kind=og`);
  assert.equal(uploads(db), 1);
});

test('warm draws the preview, then the card, in the background', async () => {
  const db = fakeSupabase();
  const { card, preview } = paths(post());

  const res = await get(`id=${POST_ID}&warm=1`);
  assert.equal(res.status, 202);
  await settle();
  const stored = db.calls.filter((call) => call.startsWith('POST /storage/v1/object/generated-cards/'));
  assert.deepEqual(stored, [`POST /storage/v1/object/generated-cards/${preview}`, `POST /storage/v1/object/generated-cards/${card}`]);
  assert.equal(db.posts.get(POST_ID).card_image_path, card);

  await get(`id=${POST_ID}&warm=1`);
  await settle();
  assert.equal(uploads(db), 2, 'a current card is not drawn again');
});

test('when something on the card changes, serves the previous drawing and redraws in the background', async () => {
  const db = fakeSupabase();
  await get(`id=${POST_ID}`);
  const old = db.posts.get(POST_ID).card_image_path;

  db.posts.get(POST_ID).author.display_name = 'Mara Vell';
  const res = await get(`id=${POST_ID}`);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), storageUrl(`generated-cards/${old}`));
  assert.equal(res.headers.get('cache-control'), 'no-store');

  await settle();
  const renamed = db.posts.get(POST_ID);
  assert.equal(renamed.card_image_path, paths(renamed).card);
  assert.notEqual(renamed.card_image_path, old);
  assert.ok(db.files.has(`generated-cards/${old}`), 'kept while cached pages may still show it');

  // A day later, the next redraw removes it.
  db.files.get(`generated-cards/${old}`).created_at = new Date(Date.now() - 2 * 86_400_000).toISOString();
  renamed.text = 'Stay soft.';
  await get(`id=${POST_ID}&warm=1`);
  await settle();
  assert.ok(!db.files.has(`generated-cards/${old}`));
  assert.ok(db.files.has(`generated-cards/${db.posts.get(POST_ID).card_image_path}`));
});

test('draws with photos from Dicta storage only', async () => {
  const photo = storageUrl(`post-images/${AUTHOR_ID}/photo.jpg`);
  const avatar = storageUrl(`avatars/${AUTHOR_ID}/avatar-1.jpg`);
  const db = fakeSupabase({
    posts: [
      post({
        author: { username: 'mara', display_name: 'Mara', avatar_url: avatar, is_verified: true },
        design: { version: 2, template: 'photograph', background: { type: 'image', image: photo } },
      }),
    ],
  });
  // No photo files exist yet: missing photos draw like in the app (initials, plain background).
  assert.equal((await get(`id=${POST_ID}`)).status, 302);
  assert.ok(db.calls.includes(`GET /storage/v1/object/public/post-images/${AUTHOR_ID}/photo.jpg`));
  assert.ok(db.calls.includes(`GET /storage/v1/object/public/avatars/${AUTHOR_ID}/avatar-1.jpg`));

  const other = fakeSupabase({
    posts: [post({ author: { username: 'mara', display_name: 'Mara', avatar_url: 'https://evil.example/a.jpg', is_verified: false }, design: { version: 2, template: 'editorial' } })],
  });
  await get(`id=${POST_ID}&kind=og`);
  assert.ok(!other.calls.some((call) => call.includes('evil')), 'never fetches other hosts');
});

test('stores nothing when a photo can’t be loaded right now', async () => {
  const db = fakeSupabase({
    posts: [post({ design: { version: 2, template: 'photograph', background: { type: 'image', image: storageUrl('post-images/x/photo.jpg') } } })],
  });
  db.storageFailure = 503;
  const res = await get(`id=${POST_ID}`);
  assert.equal(res.status, 500);
  assert.equal(uploads(db), 0);
  assert.equal(db.posts.get(POST_ID).card_image_path, null);
});

test('404s for unknown posts and bad ids', async () => {
  fakeSupabase({ posts: [] });
  assert.equal((await get(`id=${POST_ID}`)).status, 404);
  assert.equal((await get('id=nope')).status, 404);
  assert.equal((await get(`id=${POST_ID}&kind=og`)).status, 404);
});
