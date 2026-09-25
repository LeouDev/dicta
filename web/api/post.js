// A shared quote at /post/<id>: the post's artwork (drawn by the app's own renderer and
// served by /card, see card.js), <meta> tags so link previews show that artwork too, and a
// way into the app. Posts are read with the public anon key, so database rules apply.
import { waitUntil } from '@vercel/functions';

import { cardSize, parseQuoteDesign } from '../card/dist/design.mjs';
import { cardImagePath, cardKey } from '../lib/card-key.js';
import { fetchPost, isConfigured, publicUrl } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CARD_WIDTH = 1080;

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const excerpt = (text, max) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  if (!isConfigured()) return page(500, shell({ title: 'Dicta', body: missing('Dicta is being set up. Try again soon.') }));
  if (!UUID.test(id)) return notFound(url.origin);

  let post;
  try {
    post = await fetchPost(id);
  } catch {
    return page(502, shell({ title: 'Dicta', body: missing('This quote couldn’t be loaded. Please try again.') }));
  }
  if (!post) return notFound(url.origin);

  // Something on the card changed since it was drawn: show that drawing while the new one draws.
  const stale = post.card_image_path && post.card_image_path !== cardImagePath(post, cardKey(post));
  if (stale) waitUntil(fetch(`${url.origin}/api/card?id=${id}&warm=1`).catch(() => {}));

  const name = post.author.display_name || post.author.username;
  const canonical = `${url.origin}/post/${id}`;
  const title = `“${excerpt(post.text, 70)}” — ${name} on Dicta`;
  const alt = `Quote by ${name}: ${post.text.trim()}`;
  const preview = `${url.origin}/card/${id}/og.jpg`;

  return page(
    200,
    shell({
      title,
      head: `
    <link rel="canonical" href="${canonical}">
    <meta name="description" content="${esc(excerpt(post.text, 200))}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Dicta">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(excerpt(post.text, 200))}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${preview}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:alt" content="${esc(excerpt(alt, 300))}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${preview}">`,
      body: `
    <main class="shared">
      ${artwork(post, alt, url.origin)}
      <a class="author" href="dicta://user/${esc(post.author.username)}">
        ${post.author.avatar_url ? `<img src="${esc(post.author.avatar_url)}" alt="" width="40" height="40">` : `<span class="initial">${esc(name.slice(0, 1).toUpperCase())}</span>`}
        <span><strong>${esc(name)}</strong><span class="handle">@${esc(post.author.username)}</span></span>
      </a>
      <div class="actions">
        <a class="button" href="dicta://post/${id}">Open in Dicta</a>
        <p class="note">Dicta is coming soon to the App Store.</p>
      </div>
    </main>`,
    }),
    'public, s-maxage=300, stale-while-revalidate=86400',
  );
}

/** The stored card image or, before its first drawing, /card, which draws it. Sized and cornered like the app's feed. */
function artwork(post, alt, origin) {
  const design = parseQuoteDesign(post.design);
  const { height } = cardSize('original', design.canvas, CARD_WIDTH);
  const src = post.card_image_path ? publicUrl(post.card_image_path) : `${origin}/card/${post.id}.jpg`;
  return `
      <figure class="card-frame" style="--card-bg: ${esc(design.background.color)}; --card-radius: ${design.radius}">
        <img class="card" src="${esc(src)}" width="${CARD_WIDTH}" height="${height}" alt="${esc(alt)}" fetchpriority="high">
      </figure>`;
}

const missing = (message) => `
    <main class="shared empty">
      <h1>${esc(message)}</h1>
      <a class="button" href="/">Go to Dicta</a>
    </main>`;

function notFound(origin) {
  return page(
    404,
    shell({ title: 'Quote not found · Dicta', head: `<meta property="og:image" content="${origin}/og.png">`, body: missing('This quote isn’t available. It may have been deleted.') }),
    'public, s-maxage=60',
  );
}

function shell({ title, head = '', body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${esc(title)}</title>
    <link rel="icon" href="/favicon.png">
    <link rel="stylesheet" href="/styles.css">
    ${head}
  </head>
  <body>
    <header class="site"><a class="wordmark" href="/">DICTA</a></header>
    ${body}
    <footer class="site"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></footer>
  </body>
</html>`;
}

function page(status, html, cache = 'no-store') {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });
}
