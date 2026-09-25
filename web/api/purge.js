// POST /api/purge?post=<id>: drops a post that's no longer public (deleted,
// hidden, removed, or gone with its author's account) from Vercel's cache at
// once: its page, artwork and link preview, all tagged in lib/cache.js. The
// database calls it (supabase/migrations/20260927000100_push_and_purge.sql).
// Anyone may call it, but it only purges posts that really are gone.
import { dangerouslyDeleteByTag } from '@vercel/functions';

import { postTag } from '../lib/cache.js';
import { fetchPost, isConfigured } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const post = new URL(request.url).searchParams.get('post') ?? '';
  if (!isConfigured()) return status(503);
  if (!UUID.test(post)) return status(400);
  try {
    if (await fetchPost(post)) return status(409);
    await dangerouslyDeleteByTag(postTag(post));
    return status(204);
  } catch (error) {
    console.error('purge:', error);
    return status(500);
  }
}

const status = (code) => new Response(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
