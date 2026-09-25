// /card: a post's stored artwork, served from the private bucket; anything missing is drawn once.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AUTHOR_ID, ORIGIN, POST_ID, fakeSupabase, post, settle, storageUrl } from './fake-supabase.mjs';

const { GET } = await import('../api/card.js');
const { cardImagePath, cardKey, previewImagePath, toAuthor } = await import('../card/dist/design.mjs');

const get = (query) => GET(new Request(`${ORIGIN}/api/card?${query}`));
const uploads = (db) => db.calls.filter((call) => call.startsWith('POST /storage/v1/object/generated-cards/'));
const names = (row) => {
  const key = cardKey({ text: row.text, design: row.design, author: toAuthor(row.author) });
  return { card: cardImagePath(row.author_id, row.id, key), preview: previewImagePath(row.author_id, row.id, key) };
};
const bytesOf = async (res) => new Uint8Array(await res.arrayBuffer());
const isJpeg = (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8;
const TAGS = `post-${POST_ID},author-${AUTHOR_ID}`;

test('serves a stored card from the private bucket, cached and tagged for purging', async () => {
  const { card } = names(post());
  const stored = new Uint8Array([0xff, 0xd8, 1, 2, 3]);
  const db = fakeSupabase({ posts: [post({ card_image_path: card })], files: { [`generated-cards/${card}`]: stored } });

  const res = await get(`id=${POST_ID}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(await bytesOf(res), stored);
  assert.equal(res.headers.get('vercel-cache-tag'), TAGS);
  assert.match(res.headers.get('cache-control'), /s-maxage=31536000/);
  assert.equal(uploads(db).length, 0);
  assert.ok(!db.calls.some((call) => call.includes('/object/public/generated-cards')), 'never public');
});

test('draws a missing card once, with its preview, and points the post at it', async () => {
  const db = fakeSupabase();
  const { card, preview } = names(post());

  const res = await get(`id=${POST_ID}`);
  assert.equal(res.status, 200);
  assert.ok(isJpeg(await bytesOf(res)));
  assert.deepEqual(
    uploads(db).map((call) => call.split('generated-cards/')[1]),
    [preview, card],
  );
  assert.equal(db.posts.get(POST_ID).card_image_path, card);

  await get(`id=${POST_ID}`);
  assert.equal(uploads(db).length, 2, 'served from storage, not drawn again');
});

test('makes a missing preview from the stored card, without drawing the card again', async () => {
  const seed = fakeSupabase();
  await get(`id=${POST_ID}`);
  const { card, preview } = names(post());
  const cardBytes = seed.files.get(`generated-cards/${card}`).bytes;

  const db = fakeSupabase({ posts: [post({ card_image_path: card })], files: { [`generated-cards/${card}`]: cardBytes } });
  const res = await get(`id=${POST_ID}&kind=og`);
  assert.equal(res.status, 200);
  const bytes = await bytesOf(res);
  const image = globalThis.CanvasKit.MakeImageFromEncoded(bytes);
  assert.deepEqual([image.width(), image.height()], [1200, 630]);
  image.delete();
  assert.deepEqual(uploads(db).map((call) => call.split('generated-cards/')[1]), [preview]);
});

test('draws just the preview, fast, when a link is shared before the card exists', async () => {
  const db = fakeSupabase();
  const res = await get(`id=${POST_ID}&kind=og`);
  assert.equal(res.status, 200);
  assert.deepEqual(uploads(db).map((call) => call.split('generated-cards/')[1]), [names(post()).preview]);
  assert.equal(db.posts.get(POST_ID).card_image_path, null);
});

test('warm draws what’s missing in the background, once', async () => {
  const db = fakeSupabase();
  assert.equal((await get(`id=${POST_ID}&warm=1`)).status, 202);
  await settle();
  assert.equal(db.posts.get(POST_ID).card_image_path, names(post()).card);
  await get(`id=${POST_ID}&warm=1`);
  await settle();
  assert.equal(uploads(db).length, 2);
});

test('after a change, serves the previous drawing briefly and redraws in the background', async () => {
  const db = fakeSupabase();
  await get(`id=${POST_ID}`);
  const old = db.posts.get(POST_ID).card_image_path;
  const oldBytes = db.files.get(`generated-cards/${old}`).bytes;

  db.posts.get(POST_ID).author.display_name = 'Mara Vell';
  const res = await get(`id=${POST_ID}`);
  assert.equal(res.status, 200);
  assert.deepEqual(await bytesOf(res), oldBytes);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=60, s-maxage=60');

  await settle();
  const renamed = db.posts.get(POST_ID);
  assert.equal(renamed.card_image_path, names(renamed).card);
  assert.ok(db.files.has(`generated-cards/${old}`), 'kept while cached pages may still show it');

  // A day later, the next redraw removes it.
  db.files.get(`generated-cards/${old}`).created_at = new Date(Date.now() - 2 * 86_400_000).toISOString();
  renamed.text = 'Stay soft.';
  await get(`id=${POST_ID}&warm=1`);
  await settle();
  assert.ok(!db.files.has(`generated-cards/${old}`));
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
  assert.equal((await get(`id=${POST_ID}`)).status, 200);
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
  assert.equal(uploads(db).length, 0);
  assert.equal(db.posts.get(POST_ID).card_image_path, null);
});

test('404s for unknown posts, tagged so a purge clears them too', async () => {
  fakeSupabase({ posts: [] });
  const res = await get(`id=${POST_ID}`);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('vercel-cache-tag'), `post-${POST_ID}`);
  assert.equal((await get('id=nope')).status, 404);
  assert.equal((await get(`id=${POST_ID}&kind=og`)).status, 404);
});
