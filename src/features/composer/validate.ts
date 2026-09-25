import { TEXT_MAX_LENGTH, type QuoteDesign } from '@/features/quote-card/types';

/** Why a post can't be published yet, or null when it's ready. */
export function validatePost(text: string, design: QuoteDesign): string | null {
  const trimmed = text.trim();
  if (!trimmed) return 'Write something first.';
  if (trimmed.length > TEXT_MAX_LENGTH) return `Keep it under ${TEXT_MAX_LENGTH} characters.`;
  if (design.background.type === 'image' && !design.background.uri) {
    return 'Choose a photo for the background, or pick another template.';
  }
  return null;
}
