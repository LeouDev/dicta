// A shared quote at /post/<id>: real <meta> tags for link previews, the card styled from its saved
// design, and a way into the app. Posts are read with the public anon key, so database rules apply.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{3,8}$/i;

// The app's font library (src/constants/fonts.ts), as Google Fonts families.
const FONTS = {
  editorial: { family: 'DM Serif Display', weights: [400] },
  elegant: { family: 'Cormorant Garamond', weights: [500, 600, 700] },
  classic: { family: 'Libre Baskerville', weights: [400, 700] },
  modern: { family: 'Inter', weights: [400, 600, 700] },
  minimal: { family: 'DM Sans', weights: [300, 400, 500] },
  bold: { family: 'Archivo Black', weights: [400] },
  typewriter: { family: 'Courier Prime', weights: [400, 700] },
  handwritten: { family: 'Caveat', weights: [400, 600] },
};
const RATIOS = { portrait: '4 / 5', square: '1 / 1', story: '9 / 16' };
const ALIGN_Y = { top: 'flex-start', center: 'center', bottom: 'flex-end' };

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const color = (value, fallback) => (HEX.test(value ?? '') ? value : fallback);
const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const excerpt = (text, max) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return page(500, shell({ title: 'Dicta', body: missing('Dicta is being set up. Try again soon.') }));
  if (!UUID.test(id)) return notFound(url.origin);

  const select = 'text,author:profiles!posts_author_id_fkey(username,display_name,avatar_url),design:post_designs(design)';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${id}&select=${select}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return page(502, shell({ title: 'Dicta', body: missing('This quote couldn’t be loaded. Please try again.') }));
  const [post] = await res.json();
  if (!post?.author) return notFound(url.origin);

  const design = (Array.isArray(post.design) ? post.design[0] : post.design)?.design ?? {};
  const name = post.author.display_name || post.author.username;
  const canonical = `${url.origin}/post/${id}`;
  const title = `“${excerpt(post.text, 70)}” — ${name} on Dicta`;

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
    <meta property="og:image" content="${url.origin}/og.png">
    <meta name="twitter:card" content="summary">
    ${fontLink(design)}`,
      body: `
    <main class="shared">
      ${card(post, design, name, SUPABASE_URL)}
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

function card(post, design, name, supabaseUrl) {
  const font = FONTS[design.fontFamily] ?? FONTS.editorial;
  const weight = font.weights.includes(design.fontWeight) ? design.fontWeight : font.weights[0];
  const bg = design.background ?? {};
  const photo = bg.type === 'image' && typeof bg.uri === 'string' && bg.uri.startsWith(`${supabaseUrl}/storage/v1/object/public/`);
  const background =
    bg.type === 'solid'
      ? color(bg.color, '#FAF8F3')
      : bg.type === 'gradient' && Array.isArray(bg.colors)
        ? `linear-gradient(${num(bg.angle, 180)}deg, ${bg.colors.map((c) => color(c, '#FAF8F3')).join(', ')})`
        : photo
          ? `linear-gradient(rgba(0,0,0,${num(bg.dim, 0.35)}), rgba(0,0,0,${num(bg.dim, 0.35)})), url("${bg.uri.replace(/"/g, '%22')}") center / cover`
          : '#FAF8F3';
  // Design units are a 1000-wide canvas, so 1 unit = 0.1cqw of the card.
  const style = [
    `--bg: ${background}`,
    `--ink: ${color(design.textColor, '#141414')}`,
    `--meta: ${color(design.metaColor, '#6B645C')}`,
    `aspect-ratio: ${RATIOS[design.format] ?? RATIOS.portrait}`,
    `padding: ${num(design.padding, 90) / 10}cqw`,
    `justify-content: ${ALIGN_Y[design.verticalAlign] ?? 'center'}`,
  ].join('; ');
  const quote = [
    `font-family: '${font.family}', Georgia, serif`,
    `font-weight: ${weight}`,
    `font-size: ${num(design.fontSize, 64) / 10}cqw`,
    `line-height: ${num(design.lineHeight, 1.1)}`,
    `letter-spacing: ${num(design.letterSpacing, 0)}em`,
    `text-align: ${['left', 'center', 'right'].includes(design.textAlign) ? design.textAlign : 'center'}`,
    `max-width: ${Math.round(num(design.textWidth, 1) * 100)}%`,
  ].join('; ');
  return `
      <figure class="card-frame">
        <div class="card" style="${esc(style)}">
          <blockquote style="${esc(quote)}">${esc(post.text.trim())}</blockquote>
          <figcaption>${esc(name)} · @${esc(post.author.username)}</figcaption>
        </div>
      </figure>`;
}

function fontLink(design) {
  const font = FONTS[design.fontFamily] ?? FONTS.editorial;
  const family = font.family.replace(/ /g, '+');
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${family}:wght@${font.weights.join(';')}&display=swap">`;
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
