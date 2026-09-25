/**
 * The small part of the card engine the website's pages need (no Skia): reading
 * a stored design the way the app does, card sizes, and the names of stored
 * card images (card-key.ts), computed exactly as the app computes them.
 */
export { cardImagePath, cardKey, previewImagePath } from '@/features/quote-card/card-key';
export { cardSize } from '@/features/quote-card/geometry';
export { parseQuoteDesign } from '@/features/quote-card/serialize';
export { toAuthor } from '@/services/author';
