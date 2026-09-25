import { ImageFormat, drawAsImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { loadCardFonts } from './fonts';
import { loadSkImage } from './images';
import { layoutCard } from './layout';
import { QuoteCanvas } from './quote-canvas';
import { CARD_FORMATS, type CardAuthor, type CardFormat, type QuoteDesign } from './types';

export type ExportFormat = CardFormat | 'original';

export const EXPORT_OPTIONS: { format: ExportFormat; label: string; detail: string }[] = [
  { format: 'story', label: 'Story', detail: '9:16' },
  { format: 'portrait', label: 'Post', detail: '4:5' },
  { format: 'square', label: 'Square', detail: '1:1' },
  { format: 'original', label: 'Original', detail: 'As designed' },
];

/** Instagram's native width; heights follow each format's ratio. */
export const EXPORT_WIDTH = 1080;

export const resolveExportFormat = (format: ExportFormat, design: QuoteDesign): CardFormat =>
  format === 'original' ? design.format : format;

interface ExportInput {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  format: ExportFormat;
  watermark?: boolean;
}

/**
 * Renders the card offscreen at export resolution and writes a PNG to the
 * cache directory. Same layout engine and canvas as on screen, so the export
 * matches the preview; the format only changes the canvas the design flows into.
 */
export async function exportCardImage({ text, design, author, format, watermark = false }: ExportInput): Promise<string> {
  const target = resolveExportFormat(format, design);
  const [fonts, avatar, backgroundImage] = await Promise.all([
    loadCardFonts(),
    design.showProfile && design.showAvatar && author.avatarUrl ? loadSkImage(author.avatarUrl) : null,
    design.background.type === 'image' && design.background.uri ? loadSkImage(design.background.uri) : null,
  ]);

  const layout = layoutCard({ text, design, author, width: EXPORT_WIDTH, format: target, fonts, watermark });
  const image = await drawAsImage(<QuoteCanvas layout={layout} avatar={avatar} backgroundImage={backgroundImage} />, {
    width: layout.width,
    height: layout.height,
  });
  if (!image) throw new Error('Couldn’t render the card image.');

  const file = new File(Paths.cache, `dicta-${CARD_FORMATS[target].label.replace(':', 'x')}-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(image.encodeToBytes(ImageFormat.PNG, 100));
  return file.uri;
}
