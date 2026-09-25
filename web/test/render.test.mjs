// The website's renderer is the app's card engine (web/card bundles src/features/quote-card):
// every template draws in every format, at the sizes the app uses.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { CARD_WIDTH, PREVIEW_SIZE, cardImageUrls, renderCard, renderLinkPreview } = await import('../card/dist/render.mjs');
const { cardSize, parseQuoteDesign } = await import('../card/dist/design.mjs');
const { cardKey, cardImagePath, previewImagePath } = await import('../lib/card-key.js');

const TEMPLATES = ['editorial', 'minimal', 'midnight', 'typewriter', 'journal', 'modern', 'gradient', 'photograph', 'diptych', 'headline', 'grain', 'pager', 'lcd', 'ink', 'wall', 'notification', 'book', 'dialogue'];
const FORMATS = ['original', 'story', 'post', 'square'];
const author = { username: 'mara', display_name: 'Mara', avatar_url: null, is_verified: true };
const none = { avatar: null, photo: null };
const row = (design, text = 'Stay soft. It’s a strength.') => ({ text, design, author });

/** Decodes a JPEG with the CanvasKit the renderer loaded. */
function decode(bytes) {
  const CanvasKit = globalThis.CanvasKit;
  const image = CanvasKit.MakeImageFromEncoded(bytes);
  assert.ok(image, 'a valid image');
  const width = image.width();
  const height = image.height();
  const pixels = image.readPixels(0, 0, { width, height, colorType: CanvasKit.ColorType.RGBA_8888, alphaType: CanvasKit.AlphaType.Unpremul, colorSpace: CanvasKit.ColorSpace.SRGB });
  image.delete();
  const at = (x, y) => Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3));
  return { width, height, pixels, at };
}

/** Share of pixels far from the median brightness: text and marks, not an empty card. */
function ink({ pixels }) {
  const lum = [];
  for (let i = 0; i < pixels.length; i += 4) lum.push(0.3 * pixels[i] + 0.59 * pixels[i + 1] + 0.11 * pixels[i + 2]);
  const median = [...lum].sort((a, b) => a - b)[lum.length >> 1];
  return lum.filter((l) => Math.abs(l - median) > 60).length / lum.length;
}

const colorful = ({ pixels }) => {
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 90) count++;
  return count;
};

test('every template draws in every format, re-laid out rather than stretched', async () => {
  // A fifth of export size keeps 72 drawings quick; the layout is resolution-independent.
  const width = CARD_WIDTH / 5;
  for (const template of TEMPLATES) {
    const design = { version: 2, template };
    for (const format of FORMATS) {
      const { bytes, ...size } = await renderCard(row(design), none, { format, width });
      const expected = cardSize(format, parseQuoteDesign(design).canvas, width);
      assert.deepEqual(size, expected, `${template} ${format}`);
      const image = decode(bytes);
      assert.deepEqual({ width: image.width, height: image.height }, expected);
      assert.ok(ink(image) > 0.004, `${template} ${format} has text on it`);
    }
  }
});

test('draws cards at export size', async () => {
  for (const [template, format, height] of [['minimal', 'original', 1350], ['lcd', 'story', 1920], ['midnight', 'square', 1080]]) {
    const { bytes, width } = await renderCard(row({ version: 2, template }), none, { format });
    assert.equal(width, 1080);
    assert.equal(decode(bytes).height, height);
  }
});

test('link previews show the whole card on the app’s paper color', async () => {
  for (const template of ['minimal', 'midnight', 'lcd']) {
    const image = decode(await renderLinkPreview(row({ version: 2, template, canvas: template === 'lcd' ? '9:16' : undefined }), none));
    assert.deepEqual({ width: image.width, height: image.height }, PREVIEW_SIZE);
    const paper = ([r, g, b]) => Math.abs(r - 0xf7) < 6 && Math.abs(g - 0xf3) < 6 && Math.abs(b - 0xec) < 6;
    assert.ok(paper(image.at(5, 5)) && paper(image.at(1194, 624)), 'paper in the corners');
    assert.ok(!paper(image.at(600, 315)), 'the card in the middle');
    assert.ok(ink(image) > 0.001, 'with its text');
  }
});

test('draws older designs the way the app upgrades them', async () => {
  const v1 = { version: 1, template: 'editorial', format: 'story', fontFamily: 'handwritten', fontSize: 70, textColor: '#1A1714', background: { type: 'solid', color: '#F3EEE5' } };
  const { bytes, height } = await renderCard(row(v1), none);
  assert.equal(height, 1920);
  assert.ok(ink(decode(bytes)) > 0.004);
});

test('draws color emoji', async () => {
  const plain = decode((await renderCard(row({ version: 2, template: 'minimal' }, 'hello friend'), none)).bytes);
  const emoji = decode((await renderCard(row({ version: 2, template: 'minimal' }, 'hello 👋 friend'), none)).bytes);
  // Only the verified badge is colorful without the emoji.
  assert.ok(colorful(emoji) - colorful(plain) > 500);
});

test('draws the author’s photo and photo backgrounds, and skips photos it can’t read', async () => {
  const photo = (await renderCard(row({ version: 2, template: 'gradient' }), none, { width: 400 })).bytes;
  const design = { version: 2, template: 'photograph', background: { type: 'image', image: 'https://x.supabase.co/storage/v1/object/public/post-images/p.jpg' } };
  const without = decode((await renderCard(row(design), none, { width: 540 })).bytes);
  const withPhotos = decode((await renderCard(row(design), { avatar: photo, photo }, { width: 540 })).bytes);
  assert.notDeepEqual(withPhotos.at(270, 100), without.at(270, 100));

  const broken = await renderCard(row(design), { avatar: new Uint8Array([1, 2, 3]), photo: new Uint8Array([4, 5]) }, { width: 540 });
  assert.deepEqual(decode(broken.bytes).at(270, 100), without.at(270, 100));
});

test('names the photos a card needs', () => {
  const avatar = 'https://x.supabase.co/storage/v1/object/public/avatars/a.jpg';
  const withAvatar = { ...author, avatar_url: avatar };
  assert.deepEqual(cardImageUrls({ text: 'x', design: { version: 2, template: 'editorial' }, author: withAvatar }), { avatar, photo: null });
  assert.deepEqual(cardImageUrls({ text: 'x', design: { version: 2, template: 'pager' }, author: withAvatar }), { avatar: null, photo: null });
  const photo = 'https://x.supabase.co/storage/v1/object/public/post-images/p.jpg';
  assert.equal(cardImageUrls({ text: 'x', design: { version: 2, template: 'photograph', background: { type: 'image', image: photo } }, author }).photo, photo);
});

test('a new key for anything the card draws, and only for that', () => {
  const base = { id: 'p', author_id: 'u', text: 'Stay soft.', design: { version: 2, template: 'editorial', align: 'left' }, author };
  const key = cardKey(base);
  assert.match(key, /^[0-9a-f]{16}$/);
  assert.equal(cardKey({ ...base, design: { align: 'left', template: 'editorial', version: 2 } }), key, 'key order doesn’t matter');
  assert.equal(cardKey({ ...base, card_image_path: 'u/p-x.jpg', like_count: 9 }), key);
  for (const changed of [
    { text: 'Stay soft!' },
    { design: { ...base.design, align: 'right' } },
    { author: { ...author, display_name: 'Mara Vell' } },
    { author: { ...author, username: 'maravell' } },
    { author: { ...author, avatar_url: 'https://x/avatar-2.jpg' } },
    { author: { ...author, is_verified: false } },
  ]) {
    assert.notEqual(cardKey({ ...base, ...changed }), key, JSON.stringify(changed));
  }
  assert.notEqual(cardKey(base, 'another-renderer'), key);
  assert.equal(cardImagePath(base, key), `u/p-${key}.jpg`);
  assert.equal(previewImagePath(base, key), `u/p-${key}-og.jpg`);
});
