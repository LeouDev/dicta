import {
  BlurMask,
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
  vec,
  type SkImage,
} from '@shopify/react-native-skia';

import { gradientPoints, overlayStops, tornStrip } from './geometry';
import type { CardLayout, HeaderLayout, PlacedParagraph, PlacedWord } from './layout';
import { Avatar, LcdFrame, NotificationPanel, PagerFrame } from './frames';
import { luminance } from './palettes';
import { TEXTURE_KIND, textureBlend, textureEffect } from './textures';

interface QuoteCanvasProps {
  layout: CardLayout;
  avatar: SkImage | null;
  backgroundImage: SkImage | null;
}

const VERIFIED_BLUE = '#3A7BD5';
const STRIP = '#ECE8E1';

/**
 * Draws a laid-out card. Contains no layout logic and no async work, so the
 * exact same tree renders on screen (inside <Canvas>) and offscreen for export.
 */
export function QuoteCanvas({ layout, avatar, backgroundImage }: QuoteCanvasProps) {
  return (
    <Group>
      <Background layout={layout} image={backgroundImage} />
      {layout.frame === 'pager' && <PagerFrame layout={layout} />}
      {layout.frame === 'lcd' && <LcdFrame layout={layout} />}
      {layout.notification && <NotificationPanel n={layout.notification} avatar={avatar} />}
      {layout.header && <Header header={layout.header} avatar={avatar} />}

      {layout.marks.map((m, i) => (
        <Rect key={i} x={m.x} y={m.y} width={m.width} height={m.height} color={m.color} />
      ))}
      {layout.fill && <FilledWords layout={layout} />}
      {layout.words.map((word, i) => (word.fill ? null : <Word key={i} word={word} />))}

      {layout.signature && <Placed item={layout.signature} />}
      {layout.footer && <Placed item={layout.footer} />}
      {layout.watermark && <Placed item={layout.watermark} />}

      {/* Texture last, over the ink, so type looks printed rather than pasted on. */}
      {layout.texture.type !== 'none' && layout.texture.strength > 0 && textureEffect && <Texture layout={layout} />}
    </Group>
  );
}

function Placed({ item }: { item: PlacedParagraph }) {
  return <Paragraph paragraph={item.paragraph} x={item.x} y={item.y} width={item.width} />;
}

/** A word, tilted and bobbed by the editorial wave when the design has curve. */
function Word({ word }: { word: PlacedWord }) {
  const text = <Paragraph paragraph={word.paragraph} x={word.x} y={word.y} width={word.width} />;
  if (word.rotate === 0 && word.dy === 0) return text;
  return (
    <Group origin={word.pivot} transform={[{ translateY: word.dy }, { rotate: word.rotate }]}>
      {text}
    </Group>
  );
}

/** Gradient-filled text: words drawn as a mask in a layer, then the gradient composited in. */
function FilledWords({ layout }: { layout: CardLayout }) {
  const fill = layout.fill!;
  const bleed = layout.width * 0.02;
  return (
    <Group layer>
      {layout.words.map((word, i) => (word.fill ? <Word key={i} word={word} /> : null))}
      {fill.boxes.map((box, i) => {
        const { start, end } = gradientPoints(fill.angle, box, box);
        return (
          <Rect key={i} x={box.x - bleed} y={box.y - bleed} width={box.width + bleed * 2} height={box.height + bleed * 2} blendMode="srcIn">
            <LinearGradient start={vec(start.x, start.y)} end={vec(end.x, end.y)} colors={fill.colors} positions={fill.positions} />
          </Rect>
        );
      })}
    </Group>
  );
}

function Header({ header, avatar }: { header: HeaderLayout; avatar: SkImage | null }) {
  return (
    <Group>
      {header.avatar && <Avatar avatar={header.avatar} image={avatar} />}
      {header.name && <Placed item={header.name} />}
      {header.handle && <Placed item={header.handle} />}
      {header.badge && <VerifiedBadge {...header.badge} />}
    </Group>
  );
}

const CHECK = Skia.PathBuilder.Make().moveTo(7.2, 12.4).lineTo(10.5, 15.6).lineTo(16.9, 8.8).detach();

/** #3A7BD5 circle with a white check. */
function VerifiedBadge({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }, { scale: size / 24 }]}>
      <Circle cx={12} cy={12} r={12} color={VERIFIED_BLUE} />
      <Path path={CHECK} color="#FFFFFF" style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" />
    </Group>
  );
}

function Background({ layout, image }: { layout: CardLayout; image: SkImage | null }) {
  const { background: bg, width, height } = layout;

  if (bg.type === 'solid') return <Fill color={bg.color} />;

  if (bg.type === 'gradient') {
    const { start, end } = gradientPoints(bg.angle, layout);
    return (
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(start.x, start.y)} end={vec(end.x, end.y)} colors={[bg.color, bg.color2]} />
      </Rect>
    );
  }

  if (bg.type === 'split') {
    const points = tornStrip(layout);
    const path = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`;
    return (
      <Group>
        <Rect x={0} y={0} width={width / 2} height={height} color={bg.color} />
        <Rect x={width / 2} y={0} width={width / 2} height={height} color={bg.color2} />
        <Path path={path} color="#00000066">
          <BlurMask blur={width * 0.006} style="normal" />
        </Path>
        <Path path={path} color={STRIP} />
      </Group>
    );
  }

  // Photo: cover-fit, then the readability overlay (off / auto / strong).
  const overlay = overlayStops(bg.overlay, layout.vAlign, luminance(layout.textColor) < 0.5);
  return (
    <Group>
      {image ? <Image image={image} x={0} y={0} width={width} height={height} fit="cover" /> : <Fill color={bg.color} />}
      {overlay && (
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={overlay.colors} positions={overlay.positions} />
        </Rect>
      )}
    </Group>
  );
}

function Texture({ layout }: { layout: CardLayout }) {
  const texture = layout.texture.type as Exclude<CardLayout['texture']['type'], 'none'>;
  const { blendMode, dark } = textureBlend(texture, layout.dark);
  return (
    <Rect x={0} y={0} width={layout.width} height={layout.height} blendMode={blendMode}>
      <Shader
        source={textureEffect!}
        uniforms={{
          kind: TEXTURE_KIND[texture],
          intensity: layout.texture.strength,
          unit: layout.texture.unit,
          size: vec(layout.width, layout.height),
          seed: layout.texture.seed,
          dark,
          pitch: Math.max(1, layout.texture.pitch),
          phase: layout.texture.phase,
        }}
      />
    </Rect>
  );
}
