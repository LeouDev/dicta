import { ImageFormat, drawAsImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { loadCardFonts } from './fonts';
import { showsAvatar } from './geometry';
import { loadSkImage } from './images';
import { layoutCard } from './layout';
import { LinkPreview, PREVIEW_SIZE } from './link-preview';
import { QuoteCanvas } from './quote-canvas';
import type { CardAuthor, Format, QuoteDesign } from './types';

export const EXPORT_OPTIONS: { format: Format; label: string; detail: string }[] = [
  { format: 'story', label: 'Story', detail: '9:16' },
  { format: 'post', label: 'Post', detail: '4:5' },
  { format: 'square', label: 'Square', detail: '1:1' },
  { format: 'original', label: 'Original', detail: 'As designed' },
];

/** Instagram's native width; heights follow each format's ratio. */
export const EXPORT_WIDTH = 1080;

interface ExportInput {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  format: Format;
  watermark?: boolean;
}

/**
 * Renders the card offscreen at export resolution (square corners) and writes
 * a PNG to the cache directory. Same layout engine and canvas as on screen, so
 * the export matches the preview; the format re-lays out instead of stretching.
 */
export async function exportCardImage({ text, design, author, format, watermark = false }: ExportInput): Promise<string> {
  const image = await drawCard({ text, design, author, format, watermark });
  const file = new File(Paths.cache, `dicta-${format}-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(image.encodeToBytes(ImageFormat.PNG, 100));
  return file.uri;
}

/**
 * The images the website and link previews show for a post (see card-key.ts):
 * the card as designed at export width, and the 1200 × 630 preview made from
 * it. Drawn on the phone's GPU, they take a fraction of a second.
 */
export async function renderCardImages({ text, design, author }: Omit<ExportInput, 'format' | 'watermark'>) {
  const card = await drawCard({ text, design, author, format: 'original' });
  const preview = await drawAsImage(<LinkPreview card={card} canvas={design.canvas} radius={design.radius} />, PREVIEW_SIZE);
  if (!preview) throw new Error('Couldn’t render the link preview.');
  return { card: card.encodeToBytes(ImageFormat.JPEG, 90), preview: preview.encodeToBytes(ImageFormat.JPEG, 86) };
}

async function drawCard({ text, design, author, format, watermark = false }: ExportInput) {
  const [fonts, avatar, backgroundImage] = await Promise.all([
    loadCardFonts(),
    showsAvatar(design) && author.avatarUrl ? loadSkImage(author.avatarUrl) : null,
    design.background.type === 'image' && design.background.image ? loadSkImage(design.background.image) : null,
  ]);

  const layout = layoutCard({ text, design, author, width: EXPORT_WIDTH, format, fonts, watermark });
  const image = await drawAsImage(<QuoteCanvas layout={layout} avatar={avatar} backgroundImage={backgroundImage} />, {
    width: layout.width,
    height: layout.height,
  });
  if (!image) throw new Error('Couldn’t render the card image.');
  return image;
}
