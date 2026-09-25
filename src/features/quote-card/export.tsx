import { ImageFormat, drawAsImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { loadCardFonts } from './fonts';
import { loadSkImage } from './images';
import { layoutCard } from './layout';
import { QuoteCanvas } from './quote-canvas';
import { showsAvatar } from './quote-card';
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

  const file = new File(Paths.cache, `dicta-${format}-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(image.encodeToBytes(ImageFormat.PNG, 100));
  return file.uri;
}
