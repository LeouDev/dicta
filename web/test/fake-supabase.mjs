// An in-memory Supabase behind global fetch, just enough for the website's
// functions: posts and pushes over PostgREST, Storage (public buckets for
// photos, the private generated-cards bucket for card images), and Expo's push
// service.
export const SUPABASE_URL = 'https://x.supabase.co';
export const ORIGIN = 'https://dicta.test';
export const POST_ID = '11111111-1111-1111-1111-111111111111';
export const AUTHOR_ID = '22222222-2222-2222-2222-222222222222';
const CARDS = 'generated-cards';

/** A post as the website reads it (design unwrapped from post_designs). */
export function post(overrides = {}) {
  return {
    id: POST_ID,
    text: 'Stay soft. It’s a strength.',
    author_id: AUTHOR_ID,
    card_image_path: null,
    author: { username: 'mara', display_name: 'Mara', avatar_url: null, is_verified: false },
    design: { version: 2, template: 'minimal' },
    ...overrides,
  };
}

export const storageUrl = (bucketPath) => `${SUPABASE_URL}/storage/v1/object/public/${bucketPath}`;

/**
 * Installs the fake. `files` maps "bucket/path" to bytes; `pushes` maps queued
 * delivery ids to what claim_push returns; `expo(message)` answers each push
 * with a ticket. `calls` records "METHOD path?query" for every request,
 * including ones to ORIGIN; `sent` collects the messages Expo received.
 */
export function fakeSupabase({ posts = [post()], files = {}, pushes = {}, expo = () => ({ status: 'ok', id: 'ticket' }) } = {}) {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  const db = {
    posts: new Map(posts.map((p) => [p.id, structuredClone(p)])),
    pushes: new Map(Object.entries(pushes)),
    sent: [],
    removedTokens: [],
    files: new Map(Object.entries(files).map(([path, bytes]) => [path, { bytes, created_at: new Date().toISOString() }])),
    calls: [],
    storageFailure: null,
  };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const notFound = () => json({ statusCode: '404', error: 'not_found' }, 400);

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method ?? 'GET').toUpperCase();
    db.calls.push(`${method} ${url.pathname}${url.search}`);
    if (url.origin === ORIGIN) return new Response(null, { status: 202 });
    if (url.origin === 'https://exp.host') {
      const messages = JSON.parse(init.body);
      db.sent.push(...messages);
      return json({ data: messages.map(expo) });
    }
    const service = init.headers?.Authorization === 'Bearer service';

    if (url.pathname === '/rest/v1/posts') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      const row = db.posts.get(id);
      if (method === 'PATCH') {
        if (!service) return json({ message: 'permission denied' }, 401);
        if (row) Object.assign(row, JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
      return json(row ? [{ ...structuredClone(row), design: [{ design: row.design }] }] : []);
    }
    if (url.pathname === '/rest/v1/rpc/claim_push') {
      if (!service) return json({ message: 'permission denied' }, 401);
      const { p_id } = JSON.parse(init.body);
      const push = db.pushes.get(p_id) ?? null;
      db.pushes.delete(p_id);
      return json(push);
    }
    if (url.pathname === '/rest/v1/push_tokens' && method === 'DELETE') {
      if (!service) return json({ message: 'permission denied' }, 401);
      const list = url.searchParams.get('token').match(/^in\.\((.*)\)$/)[1];
      db.removedTokens.push(...list.split(',').map((token) => JSON.parse(token)));
      return new Response(null, { status: 204 });
    }

    const publicPath = url.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/)?.[1];
    if (publicPath) {
      if (db.storageFailure) return new Response('down', { status: db.storageFailure });
      const path = decodeURIComponent(publicPath);
      // Card images are private: only the service role can read them.
      const file = path.startsWith(`${CARDS}/`) ? null : db.files.get(path);
      if (!file) return notFound();
      return new Response(method === 'HEAD' ? null : file.bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    }

    if (!service) return json({ message: 'unauthorized' }, 401);
    const privatePath = url.pathname.match(/^\/storage\/v1\/object\/authenticated\/(.+)$/)?.[1];
    if (privatePath) {
      const file = db.files.get(decodeURIComponent(privatePath));
      return file ? new Response(file.bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }) : notFound();
    }
    if (url.pathname === `/storage/v1/object/list/${CARDS}`) {
      const { prefix, search } = JSON.parse(init.body);
      const names = [...db.files.keys()]
        .filter((path) => path.startsWith(`${CARDS}/${prefix}`))
        .map((path) => path.slice(`${CARDS}/${prefix}`.length))
        .filter((name) => name.startsWith(search));
      return json(names.map((name) => ({ name, created_at: db.files.get(`${CARDS}/${prefix}${name}`).created_at })));
    }
    if (url.pathname === `/storage/v1/object/${CARDS}` && method === 'DELETE') {
      for (const path of JSON.parse(init.body).prefixes) db.files.delete(`${CARDS}/${path}`);
      return json([]);
    }
    const upload = url.pathname.match(/^\/storage\/v1\/object\/(generated-cards\/.+)$/)?.[1];
    if (upload && method === 'POST') {
      db.files.set(upload, { bytes: new Uint8Array(init.body), created_at: new Date().toISOString() });
      return json({ Key: upload });
    }
    return json({ message: `unexpected ${method} ${url.pathname}` }, 500);
  };
  return db;
}

/** The Vercel request context: waitUntil() work to wait for, and cache purges. */
const background = [];
export const purged = [];
globalThis[Symbol.for('@vercel/request-context')] = {
  get: () => ({
    waitUntil: (promise) => background.push(promise),
    purge: { dangerouslyDeleteByTag: async (tags) => void purged.push(...[tags].flat()) },
  }),
};

export async function settle() {
  while (background.length) await background.shift();
}
