/**
 * The link-preview image (Open Graph, X, iMessage): the card, whole, on the
 * app's paper color with the feed's rounded corners and shadow. The app draws
 * it when it publishes and the website draws it when it's missing, both from
 * this component.
 */
import { BlurMask, FilterMode, Fill, Group, Image, MipmapMode, RoundedRect, rect, rrect, type SkImage } from '@shopify/react-native-skia';

import { colors } from '@/constants/tokens';

import { cardSize } from './geometry';
import { DESIGN_WIDTH, type Canvas } from './types';

/** Link previews are 1.91:1. */
export const PREVIEW_SIZE = { width: 1200, height: 630 };
const MARGIN = 48;

/** The card's size inside the preview: as tall as the preview allows, keeping its shape. */
export function previewCardSize(canvas: Canvas) {
  const height = PREVIEW_SIZE.height - MARGIN * 2;
  const width = Math.round(height * (DESIGN_WIDTH / cardSize('original', canvas, DESIGN_WIDTH).height));
  return cardSize('original', canvas, width);
}

/** `card` is drawn at `previewCardSize` (scaled smoothly if it's a larger render). `radius` is the design's, in design units. */
export function LinkPreview({ card, canvas, radius }: { card: SkImage; canvas: Canvas; radius: number }) {
  const { width, height } = previewCardSize(canvas);
  const r = (radius * width) / DESIGN_WIDTH;
  const x = Math.round((PREVIEW_SIZE.width - width) / 2);
  const y = Math.round((PREVIEW_SIZE.height - height) / 2);
  return (
    <Group>
      <Fill color={colors.light.background} />
      <RoundedRect x={x} y={y + 12} width={width} height={height} r={r} color="rgba(26, 23, 20, 0.2)">
        <BlurMask blur={22} style="normal" />
      </RoundedRect>
      <Group clip={rrect(rect(x, y, width, height), r, r)}>
        <Image image={card} x={x} y={y} width={width} height={height} fit="fill" sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }} />
      </Group>
    </Group>
  );
}
