// A post's artwork, as stored in the private generated-cards bucket. The app
// stores it when it publishes; anything missing is drawn here by the app's own
// renderer (web/card), stored, and served from the cache after that:
//
//   /card/<id>.jpg              the card as the app shows it, 1080 wide (post page)
//   /card/<id>/og.jpg           1200 × 630 link preview
//   /api/card?id=<id>&warm=1    draw anything missing now, in the background
//
// Pages link here with ?v=<key>, so a changed card gets a new URL. Responses are
// tagged with the post, and api/purge.js drops them once it's no longer public.
import { waitUntil } from '@vercel/functions';

import { postTag } from '../lib/cache.js';
import {
  downloadImage,
  fetchPost,
  fetchStoredImage,
  isConfigured,
  removeOldVersions,
  setCardImagePath,
  uploadImage,
} from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  if (!isConfigured() || !UUID.test(id)) return empty(404);
  try {
    const post = await fetchPost(id);
    if (!post) return empty(404, { 'Cache-Control': 'public, s-maxage=60', 'Vercel-Cache-Tag': postTag(id) });
    const names = await imageNames(post);
    const current = post.card_image_path === names.card;

    if (url.searchParams.has('warm')) {
      if (!current) waitUntil(drawAll(post, names).catch((error) => console.error(`card ${id}:`, error)));
      return empty(202);
    }

    if (url.searchParams.get('kind') === 'og') {
      let preview = await downloadImage(names.preview);
      if (!preview) {
        const card = current ? await downloadImage(names.card) : null;
        const renderer = await import('../card/dist/render.mjs');
        const row = rowOf(post);
        preview = card ? await renderer.previewFromCard(row, card) : await renderer.renderLinkPreview(row, await photosFor(renderer, row));
        await uploadImage(names.preview, preview);
      }
      return jpeg(preview, post);
    }

    if (current) {
      const card = await downloadImage(names.card);
      if (card) return jpeg(card, post);
    } else if (post.card_image_path) {
      // Something on the card changed (text, design, the author's profile, the engine):
      // show the previous drawing while this version draws.
      const previous = await downloadImage(post.card_image_path);
      if (previous) {
        waitUntil(drawAll(post, names).catch((error) => console.error(`card ${id}:`, error)));
        return jpeg(previous, post, 'public, max-age=60, s-maxage=60');
      }
    }
    return jpeg((await drawAll(post, names)).card, post);
  } catch (error) {
    console.error(`card ${id}:`, error);
    return empty(500);
  }
}

/** The stored images for this version of the post (the same names the app uses). */
async function imageNames(post) {
  const d = await import('../card/dist/design.mjs');
  const key = d.cardKey({ text: post.text, design: post.design, author: d.toAuthor(post.author) });
  return { key, card: d.cardImagePath(post.author_id, post.id, key), preview: d.previewImagePath(post.author_id, post.id, key) };
}

const rowOf = (post) => ({ text: post.text, design: post.design, author: post.author });

async function photosFor(renderer, row) {
  const urls = renderer.cardImageUrls(row);
  const [avatar, photo] = await Promise.all([fetchStoredImage(urls.avatar), fetchStoredImage(urls.photo)]);
  return { avatar, photo };
}

/** Draws the card once, makes the preview from it, stores both and points the post at the card. */
async function drawAll(post, names) {
  const renderer = await import('../card/dist/render.mjs');
  const row = rowOf(post);
  const { card, preview } = await renderer.renderCardAndPreview(row, await photosFor(renderer, row));
  await uploadImage(names.preview, preview);
  await uploadImage(names.card, card);
  await setCardImagePath(post.id, names.card);
  await removeOldVersions(post, names.key);
  return { card, preview };
}

function jpeg(bytes, post, cache = 'public, max-age=300, s-maxage=31536000') {
  return new Response(bytes, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': cache, 'Vercel-Cache-Tag': postTag(post.id) },
  });
}

const empty = (status, headers = { 'Cache-Control': 'no-store' }) => new Response(null, { status, headers });
