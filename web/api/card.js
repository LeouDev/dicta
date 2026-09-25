// A post's artwork, drawn by the app's own renderer (web/card) and stored in
// Supabase Storage, so each version is drawn once and then served from there:
//
//   /card/<id>.jpg              the card as the app shows it, 1080 wide (post page)
//   /card/<id>/og.jpg           1200 × 630 link preview
//   /api/card?id=<id>&warm=1    draw both now, in the background (the app calls
//                               this right after publishing)
import { waitUntil } from '@vercel/functions';

import { cardImagePath, cardKey, previewImagePath } from '../lib/card-key.js';
import {
  fetchPost,
  fetchStoredImage,
  imageExists,
  isConfigured,
  publicUrl,
  removeOldVersions,
  setCardImagePath,
  uploadImage,
} from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  if (!isConfigured() || !UUID.test(id)) return status(404);
  try {
    const post = await fetchPost(id);
    if (!post) return status(404);
    const key = cardKey(post);
    const card = cardImagePath(post, key);
    const current = post.card_image_path === card;

    if (url.searchParams.has('warm')) {
      if (!current) waitUntil(drawAll(post, key).catch((error) => console.error(`card ${id}:`, error)));
      return status(202);
    }

    if (url.searchParams.get('kind') === 'og') {
      const preview = previewImagePath(post, key);
      if (!(await imageExists(preview))) await drawPreview(post, key);
      return redirect(publicUrl(preview));
    }

    if (current) return redirect(publicUrl(card));
    if (post.card_image_path) {
      // Something on the card changed (text, design, the author's profile, the renderer):
      // show the previous drawing while this version draws.
      waitUntil(drawAll(post, key).catch((error) => console.error(`card ${id}:`, error)));
      return redirect(publicUrl(post.card_image_path), 'no-store');
    }
    await drawCard(post, key);
    return redirect(publicUrl(card));
  } catch (error) {
    console.error(`card ${id}:`, error);
    return status(500);
  }
}

/** The renderer (loaded once per instance) and the photos this post's card draws. */
async function prepare(post) {
  const renderer = await import('../card/dist/render.mjs');
  const row = { text: post.text, design: post.design, author: post.author };
  const urls = renderer.cardImageUrls(row);
  const [avatar, photo] = await Promise.all([fetchStoredImage(urls.avatar), fetchStoredImage(urls.photo)]);
  return { renderer, row, images: { avatar, photo } };
}

async function drawPreview(post, key, prepared) {
  const { renderer, row, images } = prepared ?? (await prepare(post));
  await uploadImage(previewImagePath(post, key), await renderer.renderLinkPreview(row, images));
}

async function drawCard(post, key, prepared) {
  const { renderer, row, images } = prepared ?? (await prepare(post));
  const path = cardImagePath(post, key);
  await uploadImage(path, (await renderer.renderCard(row, images)).bytes);
  await setCardImagePath(post.id, path);
  await removeOldVersions(post, key);
}

/** The preview first: it's small, so a link shared right after posting gets artwork soonest. */
async function drawAll(post, key) {
  const prepared = await prepare(post);
  await drawPreview(post, key, prepared);
  await drawCard(post, key, prepared);
}

function redirect(location, cache = 'public, max-age=300, s-maxage=600') {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': cache } });
}

const status = (code) => new Response(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
