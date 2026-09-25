import { cardImagePath, cardKey, previewImagePath } from '@/features/quote-card/card-key';
import { renderCardImages } from '@/features/quote-card/export';
import type { CardAuthor, QuoteDesign } from '@/features/quote-card/types';
import { supabase } from '@/lib/supabase';

interface StoredPost {
  postId: string;
  authorId: string;
  /** As stored: posts.text and post_designs.design. */
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
}

const asArrayBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/**
 * Draws a new post's website image and link preview on this device (the GPU
 * makes it near instant, where the website's CPU takes up to a minute) and
 * stores them where the website looks for them (card-key.ts).
 */
export async function storeCardImages({ postId, authorId, text, design, author }: StoredPost) {
  const key = cardKey({ text, design, author });
  const { card, preview } = await renderCardImages({ text, design, author });
  const cardPath = cardImagePath(authorId, postId, key);
  // Preview first: a link shared right away needs it most.
  for (const [path, bytes] of [
    [previewImagePath(authorId, postId, key), preview],
    [cardPath, card],
  ] as const) {
    const { error } = await supabase.storage.from('generated-cards').upload(path, asArrayBuffer(bytes), { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
  }
  const { error } = await supabase.from('posts').update({ card_image_path: cardPath }).eq('id', postId);
  if (error) throw error;
}
