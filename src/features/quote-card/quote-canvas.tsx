import {
  Circle,
  Fill,
  Group,
  Image,
  LinearGradient,
  Paragraph,
  Path,
  Rect,
  Shader,
  Skia,
  rect,
  rrect,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';

import { gradientPoints, withAlpha } from './geometry';
import type { CardLayout, PlacedParagraph } from './layout';
import { TEXTURE_KIND, textureBlend, textureEffect } from './textures';

interface QuoteCanvasProps {
  layout: CardLayout;
  avatar: SkImage | null;
  backgroundImage: SkImage | null;
}

const VERIFIED_BLUE = '#1D9BF0';
const PHOTO_PLACEHOLDER = ['#4A4A52', '#16161A'];

/**
 * Draws a laid-out card. Contains no layout logic and no async work, so the
 * exact same tree renders on screen (inside <Canvas>) and offscreen for export.
 */
export function QuoteCanvas({ layout, avatar, backgroundImage }: QuoteCanvasProps) {
  const { texture } = layout;

  return (
    <Group>
      <Background layout={layout} image={backgroundImage} />

      {layout.header && (
        <Group>
          {layout.header.avatar &&
            (avatar ? (
              <Group clip={rrect(rect(layout.header.avatar.x, layout.header.avatar.y, layout.header.avatar.size, layout.header.avatar.size), layout.header.avatar.size / 2, layout.header.avatar.size / 2)}>
                <Image
                  image={avatar}
                  x={layout.header.avatar.x}
                  y={layout.header.avatar.y}
                  width={layout.header.avatar.size}
                  height={layout.header.avatar.size}
                  fit="cover"
                />
              </Group>
            ) : (
              <Group>
                <Circle
                  cx={layout.header.avatar.x + layout.header.avatar.size / 2}
                  cy={layout.header.avatar.y + layout.header.avatar.size / 2}
                  r={layout.header.avatar.size / 2}
                  color={layout.header.avatar.ring}
                />
                <Placed item={layout.header.avatar.initials} />
              </Group>
            ))}
          <Placed item={layout.header.name} />
          {layout.header.handle && <Placed item={layout.header.handle} />}
          {layout.header.badge && <VerifiedBadge {...layout.header.badge} />}
        </Group>
      )}

      {layout.lines.map((line, i) =>
        line.angle === 0 ? (
          <Placed key={i} item={line} />
        ) : (
          <Group key={i} transform={[{ rotate: line.angle }]} origin={line.pivot}>
            <Placed item={line} />
          </Group>
        ),
      )}

      {layout.signature && <Placed item={layout.signature} />}
      {layout.watermark && <Placed item={layout.watermark} />}

      {/* Texture last, over the ink, so type looks printed rather than pasted on. */}
      {texture !== 'none' && layout.textureIntensity > 0 && textureEffect && (
        <Texture layout={layout} texture={texture} />
      )}
    </Group>
  );
}

function Texture({ layout, texture }: { layout: CardLayout; texture: Exclude<CardLayout['texture'], 'none'> }) {
  const { blendMode, dark } = textureBlend(texture, layout.background);
  return (
    <Rect x={0} y={0} width={layout.width} height={layout.height} blendMode={blendMode}>
      <Shader
        source={textureEffect!}
        uniforms={{
          kind: TEXTURE_KIND[texture],
          intensity: layout.textureIntensity,
          unit: layout.scale,
          size: vec(layout.width, layout.height),
          seed: layout.seed % 997,
          dark,
        }}
      />
    </Rect>
  );
}

function Placed({ item }: { item: PlacedParagraph }) {
  return <Paragraph paragraph={item.paragraph} x={item.x} y={item.y} width={item.width} />;
}

function Background({ layout, image }: { layout: CardLayout; image: SkImage | null }) {
  const { background, width, height } = layout;

  if (background.type === 'solid') return <Fill color={background.color} />;

  if (background.type === 'gradient') {
    const { start, end } = gradientPoints(background.angle, layout);
    return (
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(start.x, start.y)} end={vec(end.x, end.y)} colors={background.colors} />
      </Rect>
    );
  }

  // Photo: cover-fit, then a readability scrim that deepens toward the bottom.
  return (
    <Group>
      {image ? (
        <Image image={image} x={0} y={0} width={width} height={height} fit="cover" />
      ) : (
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={PHOTO_PLACEHOLDER} />
        </Rect>
      )}
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[withAlpha('#000000', background.dim * 0.45), withAlpha('#000000', background.dim * 0.7), withAlpha('#000000', background.dim)]}
        />
      </Rect>
    </Group>
  );
}

// 24×24 seal with twelve soft scallops, plus a checkmark.
const SEAL = (() => {
  const builder = Skia.PathBuilder.Make();
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 11 * (1 - 0.07 * Math.cos(12 * t));
    const x = 12 + r * Math.cos(t);
    const y = 12 + r * Math.sin(t);
    if (i === 0) builder.moveTo(x, y);
    else builder.lineTo(x, y);
  }
  return builder.close().detach();
})();

const CHECK = Skia.PathBuilder.Make().moveTo(7.4, 12.3).lineTo(10.6, 15.4).lineTo(16.8, 8.9).detach();

function VerifiedBadge({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }, { scale: size / 24 }]}>
      <Path path={SEAL} color={VERIFIED_BLUE} />
      <Path path={CHECK} color="#FFFFFF" style="stroke" strokeWidth={2.3} strokeCap="round" strokeJoin="round" />
    </Group>
  );
}
