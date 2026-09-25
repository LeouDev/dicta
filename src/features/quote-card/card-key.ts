/**
 * Names one version of a post's artwork in the generated-cards bucket. The app
 * (which draws the images when it publishes) and the website (which draws any
 * that are missing) compute it the same way, so either can store an image the
 * other recognizes.
 */
import type { CardAuthor } from './types';

/**
 * The card engine's version. Stored images are named by it, so bumping it
 * redraws every post. The engine is frozen: render.test.tsx fails when the
 * drawing changes without a bump.
 */
export const ENGINE_VERSION = 1;

export interface CardKeyInput {
  /** posts.text, as stored. */
  text: string;
  /** post_designs.design, as stored (version 1 or 2). */
  design: unknown;
  author: CardAuthor;
}

/** JSON with object keys sorted, after a JSON round trip (so it matches what the database returns). */
export function stableJson(value: unknown): string {
  const walk = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(walk).join(',')}]`;
    if (v && typeof v === 'object') {
      const record = v as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${walk(record[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(v);
  };
  return walk(JSON.parse(JSON.stringify(value ?? null)));
}

/** cyrb53 (public domain): a fast 53-bit string hash, as 14 hex characters. */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0) & 0x1fffff).toString(16).padStart(6, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** Everything the card draws: the engine, the text, the design and the author as the card shows them. */
export function cardKey({ text, design, author }: CardKeyInput): string {
  const { displayName, username, avatarUrl, isVerified } = author;
  return hash53(stableJson([ENGINE_VERSION, text, design ?? null, displayName, username, avatarUrl ?? null, isVerified === true]));
}

// Images live in the author's folder, like every user file, so deleting the
// post or the account removes them too.
export const cardImagePath = (authorId: string, postId: string, key: string) => `${authorId}/${postId}-${key}.jpg`;
export const previewImagePath = (authorId: string, postId: string, key: string) => `${authorId}/${postId}-${key}-og.jpg`;
