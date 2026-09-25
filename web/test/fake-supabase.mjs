// An in-memory Supabase behind global fetch, just enough for the website's
// functions: posts over PostgREST, and Storage (public reads, uploads, list, delete).
export const SUPABASE_URL = 'https://x.supabase.co';
export const ORIGIN = 'https://dicta.test';
export const POST_ID = '11111111-1111-1111-1111-111111111111';
export const AUTHOR_ID = '22222222-2222-2222-2222-222222222222';

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
 * Installs the fake. `files` maps "bucket/path" to bytes; `calls` records
 * "METHOD path?query" for every request, including ones to ORIGIN.
 */
export function fakeSupabase({ posts = [post()], files = {} } = {}) {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  const db = {
    posts: new Map(posts.map((p) => [p.id, structuredClone(p)])),
    files: new Map(Object.entries(files).map(([path, bytes]) => [path, { bytes, created_at: new Date().toISOString() }])),
    calls: [],
    storageFailure: null,
  };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method ?? 'GET').toUpperCase();
    db.calls.push(`${method} ${url.pathname}${url.search}`);
    if (url.origin === ORIGIN) return new Response(null, { status: 202 });
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

    const publicPath = url.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/)?.[1];
    if (publicPath) {
      if (db.storageFailure) return new Response('down', { status: db.storageFailure });
      const file = db.files.get(decodeURIComponent(publicPath));
      if (!file) return json({ statusCode: '404', error: 'not_found' }, 400);
      return new Response(method === 'HEAD' ? null : file.bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    }

    if (!service) return json({ message: 'unauthorized' }, 401);
    const bucket = 'generated-cards';
    if (url.pathname === `/storage/v1/object/list/${bucket}`) {
      const { prefix, search } = JSON.parse(init.body);
      const names = [...db.files.keys()]
        .filter((path) => path.startsWith(`${bucket}/${prefix}`))
        .map((path) => path.slice(`${bucket}/${prefix}`.length))
        .filter((name) => name.startsWith(search));
      return json(names.map((name) => ({ name, created_at: db.files.get(`${bucket}/${prefix}${name}`).created_at })));
    }
    if (url.pathname === `/storage/v1/object/${bucket}` && method === 'DELETE') {
      for (const path of JSON.parse(init.body).prefixes) db.files.delete(`${bucket}/${path}`);
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

/** Collects waitUntil() work the way Vercel does, so tests can wait for it. */
const background = [];
globalThis[Symbol.for('@vercel/request-context')] = { get: () => ({ waitUntil: (promise) => background.push(promise) }) };

export async function settle() {
  while (background.length) await background.shift();
}
