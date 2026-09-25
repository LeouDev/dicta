// POST /api/purge?post=<id> or ?author=<id>: drops a deleted post (or every post
// of a deleted account) from Vercel's cache at once: its page, artwork and link
// preview (all tagged in lib/cache.js). The app calls it right after deleting.
// Anyone may call it, but it only purges content that is no longer visible.
import { dangerouslyDeleteByTag } from '@vercel/functions';

import { fetchPost, isConfigured, profileExists } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const url = new URL(request.url);
  const post = url.searchParams.get('post');
  const author = url.searchParams.get('author');
  if (!isConfigured()) return status(503);
  try {
    if (post && UUID.test(post)) {
      if (await fetchPost(post)) return status(409);
      await dangerouslyDeleteByTag(`post-${post}`);
      return status(204);
    }
    if (author && UUID.test(author)) {
      if (await profileExists(author)) return status(409);
      await dangerouslyDeleteByTag(`author-${author}`);
      return status(204);
    }
    return status(400);
  } catch (error) {
    console.error('purge:', error);
    return status(500);
  }
}

const status = (code) => new Response(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
