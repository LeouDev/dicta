// Supabase for the website. Posts are read with the public anon key, so the
// database's rules apply (hidden and removed posts stay invisible). The service
// role key, which exists only on the server, is used for card images: reading
// and storing them in the private generated-cards bucket, and pointing
// posts.card_image_path at the current one.

export const BUCKET = 'generated-cards';

const POST_SELECT =
  'id,text,author_id,card_image_path,' +
  'author:profiles!posts_author_id_fkey(username,display_name,avatar_url,is_verified),design:post_designs(design)';

const env = () => ({ url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY });
const keyHeaders = (key) => ({ apikey: key, Authorization: `Bearer ${key}` });

export const isConfigured = () => Boolean(env().url && env().anon);

/** A visible post with its author and stored design (as saved, any version), or null. */
export async function fetchPost(id) {
  const { url, anon } = env();
  const res = await fetch(`${url}/rest/v1/posts?id=eq.${id}&select=${POST_SELECT}`, { headers: keyHeaders(anon) });
  if (!res.ok) throw new Error(`Couldn't load post ${id} (${res.status}).`);
  const [row] = await res.json();
  if (!row?.author) return null;
  const designRow = Array.isArray(row.design) ? row.design[0] : row.design;
  return { ...row, design: designRow?.design ?? null };
}

/** Whether a profile is visible (false once the account is deleted). */
export async function profileExists(id) {
  const { url, anon } = env();
  const res = await fetch(`${url}/rest/v1/profiles?id=eq.${id}&select=id`, { headers: keyHeaders(anon) });
  if (!res.ok) throw new Error(`Couldn't look up profile ${id} (${res.status}).`);
  return (await res.json()).length > 0;
}

/** A stored card image's bytes, or null if there's none. */
export async function downloadImage(path) {
  const { url, service } = env();
  const res = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${path}`, { headers: keyHeaders(service) });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't read ${path} (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * The bytes of a photo from Dicta's own storage (never another host). A missing
 * photo is null, as it's missing in the app too; other failures throw, so no
 * image is stored without it.
 */
export async function fetchStoredImage(imageUrl) {
  if (!imageUrl?.startsWith(`${env().url}/storage/v1/object/public/`)) return null;
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't load ${imageUrl} (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function uploadImage(path, bytes) {
  const { url, service } = env();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...keyHeaders(service), 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=31536000', 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Couldn't store ${path} (${res.status}): ${await res.text()}`);
}

export async function setCardImagePath(postId, path) {
  const { url, service } = env();
  const res = await fetch(`${url}/rest/v1/posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { ...keyHeaders(service), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ card_image_path: path }),
  });
  if (!res.ok) throw new Error(`Couldn't save the card image of post ${postId} (${res.status}).`);
}

/**
 * Deletes a post's images from earlier versions once they're a day old. Pages
 * cached before the redraw may still show them for a while.
 */
export async function removeOldVersions(post, key, now = Date.now()) {
  const { url, service } = env();
  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...keyHeaders(service), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: `${post.author_id}/`, search: `${post.id}-`, limit: 100 }),
  });
  if (!res.ok) return;
  const old = (await res.json())
    .filter((file) => file.name.startsWith(`${post.id}-`) && !file.name.startsWith(`${post.id}-${key}`))
    .filter((file) => now - Date.parse(file.created_at) > 86_400_000)
    .map((file) => `${post.author_id}/${file.name}`);
  if (!old.length) return;
  await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...keyHeaders(service), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: old }),
  });
}
