import { Canvas } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useCardFonts } from './fonts';
import { cardSize, isDeviceFrame, unitScale } from './geometry';
import { useSkImage } from './images';
import { layoutCard } from './layout';
import { QuoteCanvas } from './quote-canvas';
import type { CardAuthor, Format, QuoteDesign } from './types';

export interface QuoteCardProps {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  /** Rendered width in points; the height follows the format. */
  width: number;
  /** "original" (the design's canvas) unless previewing an export format. */
  format?: Format;
  /** Corner radius in points; defaults to the design's radius. Exports are square. */
  radius?: number;
  /** Small DICTA mark, for export previews. */
  watermark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Whether the card shows the author's photo (header or notification panel). */
export const showsAvatar = (design: QuoteDesign) =>
  design.frame === 'notification' || (design.header.show && design.header.avatar && !isDeviceFrame(design.frame));

/**
 * The one component every surface uses to show a card: feed, profile grid,
 * editor preview, template picker and share previews. It only computes layout
 * (memoized) and hands it to QuoteCanvas; exports reuse the same pair offscreen.
 */
export const QuoteCard = memo(function QuoteCard({ text, design, author, width, format = 'original', radius, watermark = false, style }: QuoteCardProps) {
  const fonts = useCardFonts();
  const size = cardSize(format, design.canvas, width);
  const avatar = useSkImage(showsAvatar(design) ? author.avatarUrl : null);
  const backgroundImage = useSkImage(design.background.type === 'image' ? design.background.image : null);

  const { displayName, username, isVerified, avatarUrl } = author;
  const layout = useMemo(
    () => (fonts ? layoutCard({ text, design, author: { displayName, username, isVerified, avatarUrl }, width, format, fonts, watermark }) : null),
    [fonts, text, design, displayName, username, isVerified, avatarUrl, width, format, watermark],
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Quote by ${displayName}: ${text.trim()}`}
      style={[
        {
          width: size.width,
          height: size.height,
          borderRadius: radius ?? design.radius * unitScale(width),
          overflow: 'hidden',
          backgroundColor: design.background.color,
        },
        style,
      ]}>
      {layout && (
        <Canvas style={{ width: size.width, height: size.height }} opaque>
          <QuoteCanvas layout={layout} avatar={avatar} backgroundImage={backgroundImage} />
        </Canvas>
      )}
    </View>
  );
});
