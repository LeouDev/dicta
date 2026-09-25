/**
 * Instagram and Facebook Stories, the way Apple Music shares songs: the card as
 * designed, with the feed's rounded corners and shadow, as a sticker people can
 * move and resize, over a blurred, dimmed copy of itself.
 */
import { Blur, BlurMask, Fill, Group, Image, RoundedRect, rect, rrect, type SkImage } from '@shopify/react-native-skia';

import { DESIGN_WIDTH } from './types';

/** Stories are 9:16. */
export const STORY_SIZE = { width: 1080, height: 1920 };
/** Transparent room around the sticker's card for its shadow. */
const SHADOW_ROOM = 64;

export const stickerSize = (card: SkImage) => ({ width: card.width() + SHADOW_ROOM * 2, height: card.height() + SHADOW_ROOM * 2 });

/** `card` is the export-width drawing; `radius` is the design's, in design units. */
export function StorySticker({ card, radius }: { card: SkImage; radius: number }) {
  const width = card.width();
  const height = card.height();
  const r = (radius * width) / DESIGN_WIDTH;
  return (
    <Group>
      {/* Offscreen surfaces start undefined: the corners and margin must be transparent. */}
      <Fill color="transparent" blendMode="clear" />
      <RoundedRect x={SHADOW_ROOM} y={SHADOW_ROOM + 12} width={width} height={height} r={r} color="rgba(0, 0, 0, 0.28)">
        <BlurMask blur={22} style="normal" />
      </RoundedRect>
      <Group clip={rrect(rect(SHADOW_ROOM, SHADOW_ROOM, width, height), r, r)}>
        <Image image={card} x={SHADOW_ROOM} y={SHADOW_ROOM} width={width} height={height} />
      </Group>
    </Group>
  );
}

export function StoryBackground({ card }: { card: SkImage }) {
  return (
    <Group>
      <Image image={card} x={0} y={0} width={STORY_SIZE.width} height={STORY_SIZE.height} fit="cover">
        <Blur blur={120} mode="clamp" />
      </Image>
      <Fill color="rgba(0, 0, 0, 0.2)" />
    </Group>
  );
}
