/**
 * Device frames and the notification panel. Every measurement is a fraction of
 * the card's width (w) or height (h), per Templates.md, so frames stay sharp
 * and proportional from a thumbnail to a 1080px export.
 */
import {
  BackdropBlur,
  BlurMask,
  Circle,
  Fill,
  Group,
  Image,
  LinearGradient,
  Paragraph,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  rect,
  rrect,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';

import type { AvatarLayout, CardLayout, NotificationLayout, PlacedParagraph } from './layout';

function Placed({ item }: { item: PlacedParagraph }) {
  return <Paragraph paragraph={item.paragraph} x={item.x} y={item.y} width={item.width} />;
}

export function Avatar({ avatar, image }: { avatar: AvatarLayout; image: SkImage | null }) {
  const { x, y, size } = avatar;
  if (image) {
    return (
      <Group clip={rrect(rect(x, y, size, size), size / 2, size / 2)}>
        <Image image={image} x={x} y={y} width={size} height={size} fit="cover" />
      </Group>
    );
  }
  return (
    <Group>
      <Circle cx={x + size / 2} cy={y + size / 2} r={size / 2} color={avatar.ring} />
      <Placed item={avatar.initials} />
    </Group>
  );
}

/** Retro pager: amber screen with ring and glow, MODE/SET, signal bars, date, three buttons. */
export function PagerFrame({ layout }: { layout: CardLayout }) {
  const { width: w, height: h, pager } = layout;
  const screen = { x: 0.085 * w, y: 0.2 * h, width: 0.83 * w, height: 0.5 * h };
  const r = 0.05 * w;
  const ring = 0.012 * w;
  const bars = [0.02, 0.03, 0.04, 0.05].map((bh, i) => ({ x: screen.x + 0.06 * w + i * 0.026 * w, bh: bh * w }));
  const barsBottom = screen.y + 0.1 * w;
  const buttonW = 0.22 * w;
  const buttonH = 0.12 * w;
  const buttonsX = (w - (buttonW * 3 + 0.05 * w * 2)) / 2;
  const buttonsY = screen.y + screen.height + (0.3 * h - buttonH) / 2;
  const glyph = 0.035 * w;

  return (
    <Group>
      <RoundedRect x={screen.x} y={screen.y} width={screen.width} height={screen.height} r={r} color="#F39B2F8C">
        <BlurMask blur={0.05 * w} style="outer" respectCTM />
      </RoundedRect>
      <RoundedRect x={screen.x} y={screen.y} width={screen.width} height={screen.height} r={r}>
        <RadialGradient
          c={vec(screen.x + screen.width / 2, screen.y + screen.height / 2)}
          r={Math.max(screen.width, screen.height) * 0.62}
          colors={['#FFB94D', '#F39B2F', '#D2731A']}
          positions={[0, 0.62, 1]}
        />
      </RoundedRect>
      <RoundedRect
        x={screen.x + ring / 2}
        y={screen.y + ring / 2}
        width={screen.width - ring}
        height={screen.height - ring}
        r={r - ring / 2}
        style="stroke"
        strokeWidth={ring}
        color="#0B0A09"
      />
      {bars.map((b, i) => (
        <Rect key={i} x={b.x} y={barsBottom - b.bh} width={0.016 * w} height={b.bh} color="#2A1604D9" />
      ))}
      {pager && (
        <>
          {pager.labels.map((l, i) => (
            <Placed key={i} item={l} />
          ))}
          <Placed item={pager.date} />
        </>
      )}
      {[0, 1, 2].map((i) => {
        const x = buttonsX + i * (buttonW + 0.05 * w);
        const cx = x + buttonW / 2;
        const cy = buttonsY + buttonH / 2;
        return (
          <Group key={i}>
            <RoundedRect x={x} y={buttonsY} width={buttonW} height={buttonH} r={buttonH / 2}>
              <LinearGradient start={vec(0, buttonsY)} end={vec(0, buttonsY + buttonH)} colors={['#36312C', '#1B1816']} />
            </RoundedRect>
            <RoundedRect x={x} y={buttonsY} width={buttonW} height={buttonH} r={buttonH / 2} style="stroke" strokeWidth={0.004 * w} color="#0B0A09" />
            {i === 1 ? (
              <Circle cx={cx} cy={cy} r={glyph * 0.42} color="#D59A55" />
            ) : (
              <Path
                path={
                  i === 0
                    ? `M ${cx + glyph * 0.45} ${cy - glyph * 0.5} L ${cx - glyph * 0.5} ${cy} L ${cx + glyph * 0.45} ${cy + glyph * 0.5} Z`
                    : `M ${cx - glyph * 0.45} ${cy - glyph * 0.5} L ${cx + glyph * 0.5} ${cy} L ${cx - glyph * 0.45} ${cy + glyph * 0.5} Z`
                }
                color="#D59A55"
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

/** Camera LCD: brown top, beige metal strip with viewfinder, dots and a ridged dial, black screen. */
export function LcdFrame({ layout }: { layout: CardLayout }) {
  const { width: w, height: h } = layout;
  const stripTop = 0.15 * h;
  const stripHeight = 0.13 * h;
  const mid = stripTop + stripHeight / 2;
  const dial = { cx: 0.84 * w, cy: 0.2 * h, r: 0.07 * w };
  const ridges = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return `M ${dial.cx + c * dial.r * 0.8} ${dial.cy + s * dial.r * 0.8} L ${dial.cx + c * dial.r} ${dial.cy + s * dial.r}`;
  }).join(' ');
  const screen = { x: 0.055 * w, y: 0.33 * h, width: w - 0.055 * w - 0.07 * w, height: h - 0.33 * h - 0.025 * h };
  const bezel = 0.014 * w;

  return (
    <Group>
      <Rect x={0} y={0} width={w} height={stripTop}>
        <LinearGradient start={vec(0, 0)} end={vec(0, stripTop)} colors={['#3E2D21', '#2A1F18']} />
      </Rect>
      <Rect x={0} y={stripTop} width={w} height={stripHeight}>
        <LinearGradient start={vec(0, stripTop)} end={vec(0, stripTop + stripHeight)} colors={['#DCC69C', '#9C845B']} />
      </Rect>
      <Rect x={0} y={stripTop} width={w} height={0.004 * w} color="#F3E3C0B3" />
      <Rect x={0} y={stripTop + stripHeight - 0.005 * w} width={w} height={0.005 * w} color="#00000059" />
      <RoundedRect x={0.34 * w} y={mid - 0.0375 * h} width={0.1 * w} height={0.075 * h} r={0.012 * w} color="#15110E" />
      <RoundedRect x={0.35 * w} y={mid - 0.028 * h} width={0.08 * w} height={0.056 * h} r={0.008 * w} color="#2B2520" />
      <Circle cx={0.5 * w} cy={mid} r={0.011 * w} color="#5C4B35" />
      <Circle cx={0.535 * w} cy={mid} r={0.011 * w} color="#5C4B35" />
      <Circle cx={dial.cx} cy={dial.cy} r={dial.r}>
        <LinearGradient start={vec(dial.cx, dial.cy - dial.r)} end={vec(dial.cx, dial.cy + dial.r)} colors={['#C9B288', '#6F5B3E']} />
      </Circle>
      <Path path={ridges} style="stroke" strokeWidth={dial.r * 0.035} color="#00000059" />
      <Circle cx={dial.cx} cy={dial.cy} r={dial.r * 0.55} color="#8C7652" />
      <RoundedRect x={screen.x} y={screen.y} width={screen.width} height={screen.height} r={0.02 * w} color="#0A0908" />
      <RoundedRect
        x={screen.x - bezel / 2}
        y={screen.y - bezel / 2}
        width={screen.width + bezel}
        height={screen.height + bezel}
        r={0.02 * w + bezel / 2}
        style="stroke"
        strokeWidth={bezel}
        color="#CDB88E"
      />
    </Group>
  );
}

/** Frosted panel (blur behind, 78% charcoal), avatar with a green app badge, name, "now" and a note. */
export function NotificationPanel({ n, avatar }: { n: NotificationLayout; avatar: SkImage | null }) {
  const { panel, badge } = n;
  const clip = rrect(rect(panel.x, panel.y, panel.width, panel.height), panel.radius, panel.radius);
  const bubble = { x: badge.x + badge.size * 0.2, y: badge.y + badge.size * 0.24, width: badge.size * 0.6, height: badge.size * 0.44 };

  return (
    <Group>
      <BackdropBlur blur={panel.blur} clip={clip}>
        <Fill color="#222222C7" />
      </BackdropBlur>
      <Avatar avatar={n.avatar} image={avatar} />
      <RoundedRect x={badge.x - badge.size * 0.08} y={badge.y - badge.size * 0.08} width={badge.size * 1.16} height={badge.size * 1.16} r={badge.size * 0.3} color="#2A2A2A" />
      <RoundedRect x={badge.x} y={badge.y} width={badge.size} height={badge.size} r={badge.size * 0.24} color="#34C759" />
      <RoundedRect x={bubble.x} y={bubble.y} width={bubble.width} height={bubble.height} r={bubble.height / 2} color="#FFFFFF" />
      <Path
        path={`M ${bubble.x + bubble.width * 0.18} ${bubble.y + bubble.height * 0.75} L ${bubble.x + bubble.width * 0.08} ${bubble.y + bubble.height * 1.18} L ${bubble.x + bubble.width * 0.42} ${bubble.y + bubble.height * 0.92} Z`}
        color="#FFFFFF"
      />
      <Placed item={n.name} />
      <Placed item={n.now} />
      {n.note && <Placed item={n.note} />}
    </Group>
  );
}
