// node --test: the shared-quote page styles v1 and v2 designs and survives hand-written JSON.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';
const { GET } = await import('../api/post.js');

async function render(design) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ text: 'Stay soft.\n\nIt’s a strength.', author: { username: 'mara', display_name: 'Mara', avatar_url: null }, design: [{ design }] }]));
  const res = await GET(new Request('https://example.com/api/post?id=11111111-1111-1111-1111-111111111111'));
  return { status: res.status, html: await res.text() };
}

const includesAll = (html, parts) => parts.forEach((part) => assert.ok(html.includes(part), `missing ${part}`));

test('styles version 2 designs', async () => {
  const { html } = await render({
    version: 2,
    font: 'elegant',
    weight: 500,
    italic: true,
    size: 90,
    textColor: '#EFE8DA',
    canvas: '9:16',
    align: 'left',
    vAlign: 'bottom',
    padding: 108,
    textTransform: 'uppercase',
    background: { type: 'image', image: 'https://x.supabase.co/storage/v1/object/public/p/a.jpg', overlay: 'strong' },
  });
  includesAll(html, [
    'family=Cormorant+Garamond:ital,wght@1,500',
    'font-style: italic',
    'font-size: 8.333cqw',
    'aspect-ratio: 9 / 16',
    'padding: 10.000cqw',
    'text-transform: uppercase',
    'rgba(0,0,0,0.868)',
    'justify-content: flex-end',
  ]);
  const split = await render({ version: 2, font: 'editorial', background: { type: 'split', color: '#0D0D0D', color2: '#23439B' }, size: 99999 });
  includesAll(split.html, ['#0D0D0D 47%, #ECE8E1 47% 53%, #23439B 53%', 'font-size: 22.222cqw']);
});

test('upgrades version 1 designs like the app', async () => {
  const { html } = await render({
    version: 1,
    fontFamily: 'handwritten',
    fontWeight: 600,
    fontSize: 100,
    format: 'square',
    verticalAlign: 'top',
    background: { type: 'gradient', colors: ['#111111', '#222222', '#333333'], angle: 135 },
  });
  includesAll(html, ['family=Caveat:wght@600', 'font-size: 10.000cqw', 'aspect-ratio: 1 / 1', 'linear-gradient(135deg, #111111, #333333)', 'justify-content: flex-start']);
});

test('survives junk and only shows photos from our storage', async () => {
  for (const design of ['x', 5, null, [], { font: 'constructor', canvas: 'toString' }, { background: { type: 'image', image: 'https://evil.example/a.jpg' } }]) {
    const { status, html } = await render(design);
    assert.equal(status, 200);
    assert.ok(!html.includes('evil.example'));
  }
});
