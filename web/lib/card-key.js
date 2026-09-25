// Names one version of a post's artwork. Everything the card draws goes into
// the key: the renderer, the text, the design and the author's name, handle,
// photo and badge. When any of them changes, the stored image is stale and is
// drawn again (web/api/card.js).
import { createHash } from 'node:crypto';

import { RENDERER_VERSION } from '../card/dist/version.mjs';

/** JSON with object keys sorted, so equal designs hash equally whatever order they come back in. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function cardKey(post, renderer = RENDERER_VERSION) {
  const { display_name, username, avatar_url, is_verified } = post.author;
  const drawn = [renderer, post.text, post.design ?? null, display_name ?? null, username ?? null, avatar_url ?? null, is_verified === true];
  return createHash('sha256').update(stable(drawn)).digest('hex').slice(0, 16);
}

// Images live in the author's folder of the generated-cards bucket, like every
// user file, so deleting the post or the account in the app removes them too.
export const cardImagePath = (post, key) => `${post.author_id}/${post.id}-${key}.jpg`;
export const previewImagePath = (post, key) => `${post.author_id}/${post.id}-${key}-og.jpg`;
