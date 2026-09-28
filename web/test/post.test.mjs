// /post/<id>: the post's stored artwork, and link-preview tags that point at it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ORIGIN, POST_ID, fakeSupabase, post } from './fake-supabase.mjs';

const { GET } = await import('../api/post.js');
const { listing } = await import('../lib/app-store.js');
const { cardKey, toAuthor } = await import('../card/dist/design.mjs');

async function render() {
  const res = await GET(new Request(`${ORIGIN}/api/post?id=${POST_ID}`));
  return { status: res.status, html: await res.text(), headers: res.headers };
}
const versionOf = (row) => cardKey({ text: row.text, design: row.design, author: toAuthor(row.author) });
const imgSrc = (html) => html.match(/<img class="card" src="([^"]+)"/)?.[1];
const meta = (html, property) => html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`))?.[1];

test('shows the post’s artwork at a versioned URL, sized like the design, with the app’s accessibility label', async () => {
  const row = post({ text: 'Stay <soft>.\n\nIt’s a strength.' });
  fakeSupabase({ posts: [row] });

  const { status, html, headers } = await render();
  assert.equal(status, 200);
  assert.equal(imgSrc(html), `${ORIGIN}/card/${POST_ID}.jpg?v=${versionOf(row)}`);
  assert.match(html, /width="1080" height="1350"/);
  assert.match(html, /alt="Quote by Mara: Stay &lt;soft&gt;\.\n\nIt’s a strength\."/);
  assert.match(html, /--card-bg: #FFFFFF; --card-radius: 36/);
  assert.equal(headers.get('vercel-cache-tag'), `post-${POST_ID}`);
});

test('changes the artwork URL when anything on the card changes', async () => {
  fakeSupabase({ posts: [post()] });
  const before = imgSrc((await render()).html);
  fakeSupabase({ posts: [post({ author: { username: 'mara', display_name: 'Mara Vell', avatar_url: null, is_verified: false } })] });
  assert.notEqual(imgSrc((await render()).html), before);
});

test('points link previews at the post’s artwork', async () => {
  fakeSupabase();
  const { html } = await render();
  assert.equal(meta(html, 'og:image'), `${ORIGIN}/card/${POST_ID}/og.jpg?v=${versionOf(post())}`);
  assert.equal(meta(html, 'og:image:width'), '1200');
  assert.equal(meta(html, 'og:image:height'), '630');
  assert.equal(meta(html, 'og:image:type'), 'image/jpeg');
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.equal(meta(html, 'twitter:image'), `${ORIGIN}/card/${POST_ID}/og.jpg?v=${versionOf(post())}`);
  assert.match(meta(html, 'og:image:alt'), /^Quote by Mara: Stay soft/);
});

test('sizes older designs the way the app upgrades them', async () => {
  fakeSupabase({
    posts: [post({ design: { version: 1, template: 'midnight', format: 'story', background: { type: 'solid', color: '#0E0E10' } } })],
  });
  const { html } = await render();
  assert.match(html, /width="1080" height="1920"/);
  assert.match(html, /--card-bg: #0E0E10/);
});

test('survives hand-written designs', async () => {
  for (const design of ['x', 5, null, [], { font: 'constructor', canvas: 'toString', radius: 1e9 }]) {
    fakeSupabase({ posts: [post({ design })] });
    const { status, html } = await render();
    assert.equal(status, 200);
    assert.match(html, /width="1080" height="1350"/);
    assert.match(html, /--card-radius: (\d+)"/);
    assert.ok(Number(html.match(/--card-radius: (\d+)"/)[1]) <= 80);
  }
});

test('404s for missing posts (tagged, so a purge clears them) and bad ids', async () => {
  fakeSupabase({ posts: [] });
  const missing = await render();
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('vercel-cache-tag'), `post-${POST_ID}`);
  const bad = await GET(new Request(`${ORIGIN}/api/post?id=nope`));
  assert.equal(bad.status, 404);
});

test('offers the card’s sound as a play button, and nothing for cards without one', async () => {
  fakeSupabase({ posts: [post({ design: { version: 2, template: 'minimal', sound: 'rain' } })] });
  const { html } = await render();
  assert.match(html, /<button class="sound" type="button" aria-pressed="false" data-src="\/sounds\/rain\.m4a">Play sound · Rain<\/button>/);

  for (const design of [{ version: 2, template: 'minimal' }, { version: 2, template: 'minimal', sound: '../../etc' }]) {
    fakeSupabase({ posts: [post({ design })] });
    assert.doesNotMatch((await render()).html, /class="sound"/);
  }
});

test('Safari’s app banner opens this post; the App Store button waits for the listing', async () => {
  listing.checkedAt = 0;
  fakeSupabase({ onAppStore: false });
  let { html } = await render();
  assert.equal(meta(html, 'apple-itunes-app'), `app-id=6816172939, app-argument=${ORIGIN}/post/${POST_ID}`);
  assert.doesNotMatch(html, /apps\.apple\.com/);
  assert.match(html, /coming soon to the App Store/);

  listing.checkedAt = 0;
  fakeSupabase({ onAppStore: true });
  ({ html } = await render());
  assert.match(html, /<a class="button secondary" href="https:\/\/apps\.apple\.com\/app\/id6816172939">Get Dicta on the App Store<\/a>/);
  assert.doesNotMatch(html, /coming soon/);
});
