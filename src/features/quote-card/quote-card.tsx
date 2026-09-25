import { Canvas } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius as radii } from '@/constants/tokens';

import { useCardFonts } from './fonts';
import { cardSize } from './geometry';
import { useSkImage } from './images';
import { layoutCard } from './layout';
import { QuoteCanvas } from './quote-canvas';
import type { CardAuthor, CardFormat, QuoteDesign } from './types';

export interface QuoteCardProps {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  /** Rendered width in points; height follows the format. */
  width: number;
  /** Override the design's own format (export previews). */
  format?: CardFormat;
  /** Corner radius in points; exports are always square-cornered. */
  radius?: number;
  /** Small DICTA mark, for export previews. */
  watermark?: boolean;
  style?: StyleProp<ViewStyle>;
}

function placeholderColor(design: QuoteDesign) {
  const bg = design.background;
  return bg.type === 'solid' ? bg.color : bg.type === 'gradient' ? bg.colors[0] : '#1C1C20';
}

/**
 * The one component every surface uses to show a card: feed, profile grid,
 * editor preview and template thumbnails. It only computes layout (memoized)
 * and hands it to QuoteCanvas; exports reuse the same layout + canvas offscreen.
 */
export const QuoteCard = memo(function QuoteCard({
  text,
  design,
  author,
  width,
  format = design.format,
  radius = radii.lg,
  watermark = false,
  style,
}: QuoteCardProps) {
  const fonts = useCardFonts();
  const size = cardSize(format, width);
  const avatar = useSkImage(design.showProfile && design.showAvatar ? author.avatarUrl : null);
  const backgroundImage = useSkImage(design.background.type === 'image' ? design.background.uri : null);

  const { displayName, username, isVerified, avatarUrl } = author;
  const layout = useMemo(
    () =>
      fonts
        ? layoutCard({ text, design, author: { displayName, username, isVerified, avatarUrl }, width, format, fonts, watermark })
        : null,
    [fonts, text, design, displayName, username, isVerified, avatarUrl, width, format, watermark],
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${text.trim()} — quote card by ${displayName}`}
      style={[
        { width: size.width, height: size.height, borderRadius: radius, overflow: 'hidden', backgroundColor: placeholderColor(design) },
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
