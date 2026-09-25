// A shared quote at /post/<id>: real <meta> tags for link previews, the card styled from its saved
// design, and a way into the app. Posts are read with the public anon key, so database rules apply.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{3,8}$/i;

// The app's font library (src/constants/fonts.ts), as Google Fonts families.
const FONTS = {
  editorial: { family: 'Source Serif 4', weights: [300, 500, 700], italic: true },
  display: { family: 'DM Serif Display', weights: [400], italic: true },
  classic: { family: 'Playfair Display', weights: [400, 700, 900], italic: true },
  elegant: { family: 'Cormorant Garamond', weights: [500, 600], italic: true },
  modern: { family: 'Instrument Sans', weights: [400, 500, 600, 700], italic: true },
  bold: { family: 'Archivo', weights: [700, 800, 900], italic: true },
  rounded: { family: 'Nunito', weights: [400, 700, 800] },
  typewriter: { family: 'Courier Prime', weights: [400, 700], italic: true },
  lcd: { family: 'Share Tech Mono', weights: [400] },
  pixel: { family: 'VT323', weights: [400] },
  hand: { family: 'Caveat', weights: [400, 600] },
  print: { family: 'Patrick Hand', weights: [400] },
  brush: { family: 'Caveat Brush', weights: [400] },
};
const RATIOS = { '4:5': '4 / 5', '1:1': '1 / 1', '9:16': '9 / 16' };
const ALIGN_Y = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
// Version 1 designs (a 1000-unit canvas, flat fields), upgraded the way the app does (serialize.ts).
const V1_FONTS = { editorial: 'display', elegant: 'elegant', classic: 'classic', modern: 'modern', minimal: 'modern', bold: 'bold', typewriter: 'typewriter', handwritten: 'hand' };
const V1_CANVAS = { portrait: '4:5', square: '1:1', story: '9:16' };

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const color = (value, fallback) => (HEX.test(value ?? '') ? value : fallback);
const num = (value, fallback) => (Number.isFinite(value) ? value : fallback);
// The editor's limits (DESIGN_LIMITS in the app), so a hand-written design can't blow up the page.
const clamp = (value, min, max, fallback) => Math.min(max, Math.max(min, num(value, fallback)));
// Own keys only: a design naming "constructor" must not reach Object.prototype.
const own = (map, key) => (typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : undefined);
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

function fromV1(d) {
  const bg = d.background ?? {};
  const colors = Array.isArray(bg.colors) ? bg.colors : [];
  const dim = num(bg.dim, 0.45);
  return {
    font: own(V1_FONTS, d.fontFamily),
    weight: d.fontWeight,
    size: num(d.fontSize, 64) * 1.08,
    lineHeight: d.lineHeight,
    letterSpacing: d.letterSpacing,
    textColor: d.textColor,
    align: d.textAlign,
    vAlign: d.verticalAlign,
    padding: num(d.padding, 90) * 1.08,
    textWidth: d.textWidth,
    canvas: own(V1_CANVAS, d.format),
    background:
      bg.type === 'gradient'
        ? { type: 'gradient', color: colors[0], color2: colors[colors.length - 1], angle: bg.angle }
        : bg.type === 'image'
          ? { type: 'image', image: bg.uri, overlay: dim >= 0.6 ? 'strong' : dim > 0.05 ? 'auto' : 'off' }
          : { type: 'solid', color: bg.color },
  };
}

const normalize = (d) => (typeof d !== 'object' || d === null ? {} : d.version === 2 || 'font' in d ? d : fromV1(d));

// WCAG relative luminance of #RGB / #RRGGBB (alpha ignored).
function luminance(hex) {
  const h = hex.length < 7 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function background(bg, ink, vAlign, supabaseUrl) {
  const c1 = color(bg.color, '#F3EEE5');
  const c2 = color(bg.color2, c1);
  if (bg.type === 'gradient') return `linear-gradient(${num(bg.angle, 160)}deg, ${c1}, ${c2})`;
  // The torn strip between the halves, as a straight cream band.
  if (bg.type === 'split') return `linear-gradient(90deg, ${c1} 47%, #ECE8E1 47% 53%, ${c2} 53%)`;
  const photo = bg.type === 'image' && typeof bg.image === 'string' && bg.image.startsWith(`${supabaseUrl}/storage/v1/object/public/`);
  if (!photo) return bg.type === 'image' ? '#2A2927' : c1;
  // The app's readability overlay: 10% → 26% → 62%, reversed for top text, ×1.4 when strong.
  const k = bg.overlay === 'strong' ? 1.4 : bg.overlay === 'off' ? 0 : 1;
  const rgb = luminance(ink) < 0.5 ? '255,255,255' : '0,0,0';
  const alphas = [0.1, 0.26, 0.62].map((a) => Math.min(0.92, a * k));
  if (vAlign === 'top') alphas.reverse();
  return `linear-gradient(${alphas.map((a) => `rgba(${rgb},${a})`).join(', ')}), url("${bg.image.replace(/"/g, '%22')}") center / cover`;
}

// The one face a card uses: its font, a weight that font has, and italic only where it exists.
function typeface(design) {
  const font = own(FONTS, design.font) ?? FONTS.editorial;
  const weight = font.weights.includes(design.weight) ? design.weight : font.weights[font.weights.length - 1];
  return { family: font.family, weight, italic: design.italic === true && font.italic === true };
}

function card(post, raw, name, supabaseUrl) {
  const design = normalize(raw);
  const face = typeface(design);
  const ink = color(design.textColor, '#9B1B1E');
  const vAlign = own(ALIGN_Y, design.vAlign) ? design.vAlign : 'center';
  // Design units are a 1080-wide canvas: 1 unit = 100/1080 cqw of the card.
  const cqw = (units) => `${((units * 100) / 1080).toFixed(3)}cqw`;
  const style = [
    `--bg: ${background(design.background ?? {}, ink, vAlign, supabaseUrl)}`,
    `--ink: ${ink}`,
    `--meta: color-mix(in srgb, ${ink} 65%, transparent)`,
    `aspect-ratio: ${own(RATIOS, design.canvas) ?? RATIOS['4:5']}`,
    `padding: ${cqw(clamp(design.padding, 0, 220, 96))}`,
    `justify-content: ${ALIGN_Y[vAlign]}`,
  ].join('; ');
  const quote = [
    `font-family: '${face.family}', Georgia, serif`,
    `font-weight: ${face.weight}`,
    `font-style: ${face.italic ? 'italic' : 'normal'}`,
    `font-size: ${cqw(clamp(design.size, 28, 240, 92))}`,
    `line-height: ${clamp(design.lineHeight, 0.8, 1.9, 1.04)}`,
    `letter-spacing: ${clamp(design.letterSpacing, -0.08, 0.3, 0)}em`,
    `text-transform: ${design.textTransform === 'uppercase' ? 'uppercase' : 'none'}`,
    `text-align: ${['left', 'center', 'right'].includes(design.align) ? design.align : 'center'}`,
    `max-width: ${Math.round(clamp(design.textWidth, 0.5, 1, 1) * 100)}%`,
  ].join('; ');
  return `
      <figure class="card-frame">
        <div class="card" style="${esc(style)}">
          <blockquote style="${esc(quote)}">${esc(post.text.trim())}</blockquote>
          <figcaption>${esc(name)} · @${esc(post.author.username)}</figcaption>
        </div>
      </figure>`;
}

function fontLink(raw) {
  const face = typeface(normalize(raw));
  const axes = face.italic ? `ital,wght@1,${face.weight}` : `wght@${face.weight}`;
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${face.family.replace(/ /g, '+')}:${axes}&display=swap">`;
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
