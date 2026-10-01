// Draws the template cards on the home page (public/samples/<template>.webp) with the
// app's own renderer, so they look exactly like cards in the app. After a renderer change:
//   npm run build && node card/samples.mjs
// The photo cards beside them (public/samples/post-*.webp) are real posts saved from the app.
import { mkdirSync, writeFileSync } from 'node:fs';

const { renderCard } = await import('./dist/render.mjs');

const SAMPLES = {
  magazine: 'Softness is its own kind of strength.',
  gradient: 'Your pace is not a verdict.',
  lcd: 'Protect your peace like it pays rent.',
  journal: 'Keep a little light in your pocket for the long days.',
  verse: 'And after the storm\n\nthe light\n\nfinds its *way* back to you',
  book: 'Read this slowly.\n\nThen tell someone you are glad they exist.',
};

const out = new URL('../public/samples/', import.meta.url);
mkdirSync(out, { recursive: true });
const author = { username: 'dicta', display_name: 'Dicta', avatar_url: null, is_verified: false };
const { CanvasKit } = globalThis;
for (const [template, text] of Object.entries(SAMPLES)) {
  // No header: the words are the point here.
  const { bytes } = await renderCard({ text, design: { version: 2, template, header: { show: false } }, author }, { avatar: null, photo: null }, { width: 640 });
  const image = CanvasKit.MakeImageFromEncoded(bytes);
  const webp = image.encodeToBytes(CanvasKit.ImageFormat.WEBP, 80);
  image.delete();
  writeFileSync(new URL(`${template}.webp`, out), webp);
  console.log(template, Math.round(webp.length / 1024), 'KB');
}
