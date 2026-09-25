// /post/<id>: the post's stored artwork, and link-preview tags that point at it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ORIGIN, POST_ID, fakeSupabase, post, settle, storageUrl } from './fake-supabase.mjs';

const { GET } = await import('../api/post.js');
const { cardImagePath, cardKey } = await import('../lib/card-key.js');

async function render() {
  const res = await GET(new Request(`${ORIGIN}/api/post?id=${POST_ID}`));
  return { status: res.status, html: await res.text() };
}
const imgSrc = (html) => html.match(/<img class="card" src="([^"]+)"/)?.[1];
const meta = (html, property) => html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`))?.[1];

test('shows the stored artwork, sized like the design, with the app’s accessibility label', async () => {
  const row = post({ text: 'Stay <soft>.\n\nIt’s a strength.' });
  const path = cardImagePath(row, cardKey(row));
  const db = fakeSupabase({ posts: [{ ...row, card_image_path: path }] });

  const { status, html } = await render();
  assert.equal(status, 200);
  assert.equal(imgSrc(html), storageUrl(`generated-cards/${path}`));
  assert.match(html, /width="1080" height="1350"/);
  assert.match(html, /alt="Quote by Mara: Stay &lt;soft&gt;\.\n\nIt’s a strength\."/);
  assert.match(html, /--card-bg: #FFFFFF; --card-radius: 36/);
  await settle();
  assert.ok(!db.calls.some((call) => call.includes('warm')), 'a current card needs no redraw');
});

test('points link previews at the post’s artwork', async () => {
  fakeSupabase();
  const { html } = await render();
  assert.equal(meta(html, 'og:image'), `${ORIGIN}/card/${POST_ID}/og.jpg`);
  assert.equal(meta(html, 'og:image:width'), '1200');
  assert.equal(meta(html, 'og:image:height'), '630');
  assert.equal(meta(html, 'og:image:type'), 'image/jpeg');
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.equal(meta(html, 'twitter:image'), `${ORIGIN}/card/${POST_ID}/og.jpg`);
  assert.match(meta(html, 'og:image:alt'), /^Quote by Mara: Stay soft/);
});

test('before the first drawing, the image comes from /card, which draws it', async () => {
  fakeSupabase();
  const { html } = await render();
  assert.equal(imgSrc(html), `${ORIGIN}/card/${POST_ID}.jpg`);
});

test('after a change, shows the previous drawing and asks for a new one', async () => {
  const db = fakeSupabase({ posts: [post({ card_image_path: `x/${POST_ID}-old.jpg` })] });
  const { html } = await render();
  assert.equal(imgSrc(html), storageUrl(`generated-cards/x/${POST_ID}-old.jpg`));
  await settle();
  assert.ok(db.calls.includes(`GET /api/card?id=${POST_ID}&warm=1`));
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

test('404s for missing posts and bad ids', async () => {
  fakeSupabase({ posts: [] });
  assert.equal((await render()).status, 404);
  const bad = await GET(new Request(`${ORIGIN}/api/post?id=nope`));
  assert.equal(bad.status, 404);
});
