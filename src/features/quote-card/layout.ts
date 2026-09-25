import { Skia, TextAlign as SkTextAlign, type SkParagraph, type SkTypefaceFontProvider } from '@shopify/react-native-skia';

import { FONT_LIBRARY, UI_FACES, resolveFace } from '@/constants/fonts';

import { compose, flowColumns, splitParagraphs, type FlowResult } from './flow';
import {
  alignBlock,
  cardSize,
  contentInsets,
  fitSize,
  hashString,
  initials,
  isDeviceFrame,
  parseLinearGradient,
  unitScale,
  wave,
  withAlpha,
  type Box,
  type Insets,
  type Size,
} from './geometry';
import { isDarkDesign } from './palettes';
import type { CardAuthor, CardBackground, Format, Frame, QuoteDesign, TextAlign, TextureKey, VerticalAlign } from './types';

export interface PlacedParagraph {
  paragraph: SkParagraph;
  x: number;
  y: number;
  width: number;
}

export interface PlacedWord extends PlacedParagraph {
  /** Radians, around `pivot`. */
  rotate: number;
  dy: number;
  pivot: { x: number; y: number };
  /** Painted with the design's text gradient. */
  fill: boolean;
}

export interface AvatarLayout {
  x: number;
  y: number;
  size: number;
  initials: PlacedParagraph;
  ring: string;
}

export interface HeaderLayout {
  avatar: AvatarLayout | null;
  name: PlacedParagraph | null;
  handle: PlacedParagraph | null;
  badge: { x: number; y: number; size: number } | null;
}

export interface NotificationLayout {
  panel: Box & { radius: number; blur: number };
  avatar: AvatarLayout;
  badge: { x: number; y: number; size: number };
  name: PlacedParagraph;
  now: PlacedParagraph;
  note: PlacedParagraph | null;
}

export interface CardLayout extends Size {
  scale: number;
  dark: boolean;
  background: CardBackground;
  textColor: string;
  vAlign: VerticalAlign;
  frame: Frame;
  texture: { type: TextureKey; strength: number; unit: number; seed: number; pitch: number; phase: number };
  words: PlacedWord[];
  marks: (Box & { color: string })[];
  fill: { boxes: Box[]; angle: number; colors: string[]; positions: number[] } | null;
  header: HeaderLayout | null;
  signature: PlacedParagraph | null;
  footer: PlacedParagraph | null;
  watermark: PlacedParagraph | null;
  pager: { labels: PlacedParagraph[]; date: PlacedParagraph } | null;
  notification: NotificationLayout | null;
}

export interface LayoutInput {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  /** Pixel width; the height follows from the format. */
  width: number;
  /** "original" uses the design's canvas; exports re-lay out for their size. */
  format?: Format;
  fonts: SkTypefaceFontProvider;
  watermark?: boolean;
}

const SK_ALIGN: Record<TextAlign, SkTextAlign> = { left: SkTextAlign.Left, center: SkTextAlign.Center, right: SkTextAlign.Right };
const UNLIMITED = 100_000;
const CREAM = '#F3EEE5';

interface TextOptions {
  face: string;
  size: number;
  color: string;
  align?: TextAlign;
  letterSpacing?: number;
  lineHeight?: number;
  maxLines?: number;
  shadows?: { color: string; blur: number }[];
}

function paragraph(text: string, o: TextOptions, fonts: SkTypefaceFontProvider, width: number): SkParagraph {
  // Skia's JSI bridge rejects undefined values, so optional keys are only added when set.
  const builder = Skia.ParagraphBuilder.Make(
    { textAlign: SK_ALIGN[o.align ?? 'left'], ...(o.maxLines ? { maxLines: o.maxLines, ellipsis: '…' } : {}) },
    fonts,
  );
  builder.pushStyle({
    color: Skia.Color(o.color),
    fontFamilies: [o.face],
    fontSize: o.size,
    letterSpacing: (o.letterSpacing ?? 0) * o.size,
    ...(o.lineHeight ? { heightMultiplier: o.lineHeight, halfLeading: true } : {}),
    ...(o.shadows ? { shadows: o.shadows.map((s) => ({ color: Skia.Color(s.color), offset: { x: 0, y: 0 }, blurRadius: s.blur })) } : {}),
  });
  builder.addText(text);
  const p = builder.build();
  p.layout(width);
  return p;
}

// Word widths at 100px, per face and tracking. Widths scale linearly with size,
// so the fit search is arithmetic after the first measurement.
const widths = new Map<string, number>();
function measureWord(fonts: SkTypefaceFontProvider, face: string, letterSpacing: number, word: string): number {
  const key = `${face}|${letterSpacing}|${word}`;
  let w = widths.get(key);
  if (w === undefined) {
    if (widths.size > 5000) widths.clear();
    w = paragraph(word, { face, size: 100, color: '#000000', letterSpacing }, fonts, UNLIMITED).getLongestLine();
    widths.set(key, w);
  }
  return w;
}

const offsetFor = (align: TextAlign, outer: number, inner: number) => (align === 'center' ? (outer - inner) / 2 : align === 'right' ? outer - inner : 0);

/**
 * Lays out a quote card at a concrete pixel size. A pure function of its inputs:
 * the feed, the editor preview and every export call it with the same design;
 * only the size and format change. Type shrinks to fit (Story may grow to 115%).
 */
export function layoutCard({ text, design, author, width, format = 'original', fonts, watermark = false }: LayoutInput): CardLayout {
  const size = cardSize(format, design.canvas, width);
  const s = unitScale(width);
  const { frame } = design;
  const insets = contentInsets({ format, frame, size, scale: s, padding: design.padding, topOffset: design.topOffset });
  const content: Box = { x: insets.left, y: insets.top, width: size.width - insets.left - insets.right, height: size.height - insets.top - insets.bottom };
  const dark = isDarkDesign(design);
  const face = resolveFace(design.font, design.weight, design.italic);
  const columns = compose(design, splitParagraphs(text));
  const hiScale = format === 'story' && !isDeviceFrame(frame) ? 1.15 : 1;
  const flowAt = (fontSize: number, blockWidth: number) =>
    flowColumns(columns, {
      size: fontSize,
      width: blockWidth,
      colGap: design.colGap * s,
      // The torn strip is 6% wide with jagged edges; text the same color as it would vanish.
      minColumnGap: design.background.type === 'split' ? 0.11 * size.width : 0,
      lineHeight: design.lineHeight,
      kickerScale: design.kickerScale,
      align: design.align,
      wordGap: FONT_LIBRARY[design.font].wordGap,
      measure: (w) => measureWord(fonts, face, design.letterSpacing, w),
    });

  const body =
    frame === 'notification'
      ? layoutNotification({ design, author, fonts, size, s, content, flowAt, hiScale })
      : layoutPlain({ design, author, fonts, s, content, dark, flowAt, hiScale });

  const words = placeWords(body.flow, body.origin, design, face, fonts);
  const fillGradient = design.textFill ? parseLinearGradient(design.textFill) : null;
  const firstBody = words.find((_, i) => body.flow.words[i].role === 'body');

  return {
    ...size,
    scale: s,
    dark,
    background: design.background,
    textColor: design.textColor,
    vAlign: design.vAlign,
    frame,
    texture: {
      type: design.texture.type,
      strength: design.texture.strength,
      unit: Math.max(0.45, s * 2),
      seed: hashString(text) % 997,
      pitch: body.fontSize * design.lineHeight,
      phase: firstBody ? firstBody.y + (firstBody.paragraph.getLineMetrics()[0]?.baseline ?? 0) : content.y,
    },
    words,
    marks: body.flow.marks.map((m) => ({ ...m, x: m.x + body.origin.x, y: m.y + body.origin.y, color: design.highlight })),
    fill: fillGradient
      ? {
          ...fillGradient,
          boxes: body.flow.boxes.filter((b) => b.role !== 'kicker').map((b) => ({ x: b.x + body.origin.x, y: b.y + body.origin.y, width: b.width, height: b.height })),
        }
      : null,
    header: body.header,
    signature: body.signature,
    footer: design.footer ? buildFooter(design, author, size, insets, s, fonts) : null,
    watermark: watermark ? buildWatermark(dark, size, insets, s, frame, fonts) : null,
    pager: frame === 'pager' ? buildPagerText(size, text, design.textColor, fonts) : null,
    notification: body.notification,
  };
}

interface BodyInput {
  design: QuoteDesign;
  author: CardAuthor;
  fonts: SkTypefaceFontProvider;
  s: number;
  content: Box;
  flowAt: (fontSize: number, blockWidth: number) => FlowResult;
  hiScale: number;
}

interface BodyLayout {
  fontSize: number;
  flow: FlowResult;
  origin: { x: number; y: number };
  header: HeaderLayout | null;
  signature: PlacedParagraph | null;
  notification: NotificationLayout | null;
}

/** Header, text block and signature stacked as one group, aligned vertically. */
function layoutPlain({ design, author, fonts, s, content, dark, flowAt, hiScale }: BodyInput & { dark: boolean }): BodyLayout {
  const device = isDeviceFrame(design.frame);
  const header = design.header.show && !device ? buildHeader(design, author, s, content.width, fonts, dark) : null;
  const headerSpace = header ? header.height + 64 * design.header.scale * s : 0;
  const blockWidth = content.width * design.textWidth;
  const signature = design.signature.show && !device ? buildSignature(design, author, s, blockWidth, fonts) : null;
  const signatureGap = 48 * s;
  const signatureSpace = signature ? signatureGap + signature.getHeight() : 0;
  const available = content.height - headerSpace - signatureSpace;

  const fontSize = fitSize(
    design.size * s,
    (f) => {
      const r = flowAt(f, blockWidth);
      return r.fits && r.height <= available;
    },
    hiScale,
  );
  const flow = flowAt(fontSize, blockWidth);

  let top = alignBlock(design.vAlign, content.y, content.height, headerSpace + flow.height + signatureSpace);
  const placedHeader = header ? header.place(content.x, content.width, top, design.header.position) : null;
  top += headerSpace;
  const x = content.x + offsetFor(design.blockAlign ?? design.align, content.width, blockWidth);

  return {
    fontSize,
    flow,
    origin: { x, y: top },
    header: placedHeader,
    signature: signature ? { paragraph: signature, x, y: top + flow.height + signatureGap, width: blockWidth } : null,
    notification: null,
  };
}

/** A frosted notification panel: avatar + badge, then name · now, the quote and an italic note. */
function layoutNotification({ design, author, fonts, size, s, content, flowAt, hiScale }: BodyInput & { size: Size }): BodyLayout {
  const W = size.width;
  const pad = 0.05 * W;
  const gap = 0.035 * W;
  const columnWidth = (f: number) => content.width - pad * 2 - f * 2.5 - gap;
  const noteText = design.signature.text.trim() || `— ${author.displayName}`;
  const noteAt = (f: number) =>
    design.signature.show ? paragraph(noteText, { face: UI_FACES.note, size: f * 0.95, color: withAlpha(design.textColor, 0.6) }, fonts, columnWidth(f)) : null;
  const nameAt = (f: number) => paragraph(author.displayName, { face: UI_FACES.name, size: f * 1.05, color: design.textColor, maxLines: 1 }, fonts, columnWidth(f) * 0.75);
  const measure = (f: number) => {
    const flow = flowAt(f, columnWidth(f));
    const name = nameAt(f);
    const note = noteAt(f);
    const inner = name.getHeight() + f * 0.3 + flow.height + (note ? f * 0.45 + note.getHeight() : 0);
    return { flow, name, note, height: pad * 2 + Math.max(f * 2.5, inner) };
  };

  const fontSize = fitSize(
    design.size * s,
    (f) => {
      const m = measure(f);
      return m.flow.fits && m.height <= content.height;
    },
    hiScale,
  );
  const m = measure(fontSize);
  const panel = { x: content.x, y: alignBlock(design.vAlign, content.y, content.height, m.height), width: content.width, height: m.height };
  const avatarSize = fontSize * 2.5;
  const colX = panel.x + pad + avatarSize + gap;
  const colWidth = columnWidth(fontSize);
  const top = panel.y + pad;
  const now = paragraph('now', { face: UI_FACES.handle, size: fontSize * 0.9, color: withAlpha(design.textColor, 0.5), align: 'right' }, fonts, colWidth);
  const flowTop = top + m.name.getHeight() + fontSize * 0.3;

  return {
    fontSize,
    flow: m.flow,
    origin: { x: colX, y: flowTop },
    header: null,
    signature: null,
    notification: {
      panel: { ...panel, radius: 0.05 * W, blur: 14 * s },
      avatar: avatarLayout(author, panel.x + pad, top, avatarSize, design.textColor, true, fonts),
      badge: { x: panel.x + pad + avatarSize * 0.66, y: top + avatarSize * 0.66, size: avatarSize * 0.38 },
      name: { paragraph: m.name, x: colX, y: top, width: colWidth * 0.75 },
      now: { paragraph: now, x: colX, y: top + (m.name.getHeight() - now.getHeight()) / 2, width: colWidth },
      note: m.note ? { paragraph: m.note, x: colX, y: flowTop + m.flow.height + fontSize * 0.45, width: colWidth } : null,
    },
  };
}

function placeWords(flow: FlowResult, origin: { x: number; y: number }, design: QuoteDesign, face: string, fonts: SkTypefaceFontProvider): PlacedWord[] {
  const filled = design.textFill !== null && parseLinearGradient(design.textFill) !== null;
  return flow.words.map((w) => {
    const color = w.role === 'kicker' ? (design.kickerColor ?? design.textColor) : w.role === 'highlight' ? (design.highlightText ?? design.textColor) : design.textColor;
    const fill = filled && w.role !== 'kicker';
    const p = paragraph(
      w.text,
      {
        face,
        size: w.size,
        color: fill ? '#FFFFFF' : color,
        letterSpacing: design.letterSpacing,
        lineHeight: w.lineHeight / w.size,
        ...(design.glow ? { shadows: [{ color: design.glow, blur: w.size * 0.14 }, { color: design.glow, blur: w.size * 0.4 }] } : {}),
      },
      fonts,
      UNLIMITED,
    );
    const x = origin.x + w.x;
    const y = origin.y + w.y;
    const { rotate, dy } = wave(w.index, design.curve);
    return {
      paragraph: p,
      x,
      y,
      // Slack for glyph overhang; the paragraph is left-aligned and never wraps.
      width: w.width + w.size,
      rotate: (rotate * Math.PI) / 180,
      dy: dy * w.size,
      // Skia rotates around the pivot first, then applies the bob.
      pivot: { x: x + w.width / 2, y: y + w.lineHeight / 2 },
      fill,
    };
  });
}

function avatarLayout(author: CardAuthor, x: number, y: number, size: number, ink: string, dark: boolean, fonts: SkTypefaceFontProvider): AvatarLayout {
  const monogram = paragraph(initials(author.displayName), { face: UI_FACES.monogram, size: size * 0.4, color: ink, align: 'center' }, fonts, size);
  return {
    x,
    y,
    size,
    initials: { paragraph: monogram, x, y: y + (size - monogram.getHeight()) / 2, width: size },
    ring: withAlpha(dark ? CREAM : '#141414', dark ? 0.14 : 0.08),
  };
}

/** Avatar 190, name 54, handle 46, gap 30 (@1080 × header.scale); badge is 0.86× the name. */
function buildHeader(design: QuoteDesign, author: CardAuthor, s: number, contentWidth: number, fonts: SkTypefaceFontProvider, dark: boolean) {
  const h = design.header;
  const k = h.scale * s;
  const avatarSize = h.avatar ? 190 * k : 0;
  const nameSize = 54 * k;
  const gap = avatarSize ? 30 * k : 0;
  const badgeSize = h.name && h.verified && author.isVerified ? nameSize * 0.86 : 0;
  const nameColor = dark ? CREAM : '#0F1419';
  const handleColor = dark ? withAlpha(CREAM, 0.68) : '#5E6B7B';
  const textWidth = Math.max(40, contentWidth - avatarSize - gap - badgeSize * 1.3);

  const name = h.name ? paragraph(author.displayName, { face: UI_FACES.name, size: nameSize, color: nameColor, maxLines: 1 }, fonts, textWidth) : null;
  const handle = h.username ? paragraph(`@${author.username}`, { face: UI_FACES.handle, size: 46 * k, color: handleColor, maxLines: 1 }, fonts, textWidth) : null;
  if (!avatarSize && !name && !handle) return null;

  const lineGap = name && handle ? nameSize * 0.06 : 0;
  const textBlock = (name?.getHeight() ?? 0) + lineGap + (handle?.getHeight() ?? 0);
  const height = Math.max(avatarSize, textBlock);

  const place = (left: number, width: number, top: number, position: QuoteDesign['header']['position']): HeaderLayout => {
    const nameWidth = name?.getLongestLine() ?? 0;
    const rowWidth = avatarSize + gap + Math.max(nameWidth + badgeSize * 1.25, handle?.getLongestLine() ?? 0);
    const rowX = position === 'top-center' ? left + (width - rowWidth) / 2 : left;
    const textX = rowX + avatarSize + gap;
    const textTop = top + (height - textBlock) / 2;
    return {
      avatar: avatarSize ? avatarLayout(author, rowX, top + (height - avatarSize) / 2, avatarSize, dark ? CREAM : '#141414', dark, fonts) : null,
      name: name ? { paragraph: name, x: textX, y: textTop, width: textWidth } : null,
      handle: handle ? { paragraph: handle, x: textX, y: textTop + (name?.getHeight() ?? 0) + lineGap, width: textWidth } : null,
      badge: badgeSize && name ? { x: textX + nameWidth + badgeSize * 0.25, y: textTop + (name.getHeight() - badgeSize) / 2, size: badgeSize } : null,
    };
  };

  return { height, place };
}

function buildSignature(design: QuoteDesign, author: CardAuthor, s: number, width: number, fonts: SkTypefaceFontProvider): SkParagraph {
  const text = design.signature.text.trim() || `— ${author.displayName}`;
  const style = {
    script: { face: UI_FACES.script, size: 64, alpha: 1, letterSpacing: 0, upper: false },
    serif: { face: UI_FACES.serifItalic, size: 46, alpha: 0.9, letterSpacing: 0, upper: false },
    caps: { face: UI_FACES.caption, size: 30, alpha: 0.8, letterSpacing: 0.16, upper: true },
    note: { face: UI_FACES.note, size: 40, alpha: 0.7, letterSpacing: 0, upper: false },
  }[design.signature.style];
  return paragraph(
    style.upper ? text.toUpperCase() : text,
    { face: style.face, size: style.size * s, color: withAlpha(design.textColor, style.alpha), align: design.align, letterSpacing: style.letterSpacing },
    fonts,
    width,
  );
}

/** The band under the text area: the bottom padding, above a story's safe zone. */
function bottomBand(size: Size, insets: Insets, s: number, frame: Frame, padding: number) {
  if (isDeviceFrame(frame)) return { top: size.height - 90 * s, height: 60 * s };
  const band = Math.min(padding, insets.bottom);
  return { top: size.height - insets.bottom, height: Math.max(band, 40 * s) };
}

function buildFooter(design: QuoteDesign, author: CardAuthor, size: Size, insets: Insets, s: number, fonts: SkTypefaceFontProvider): PlacedParagraph {
  const width = size.width - insets.left - insets.right;
  const p = paragraph(
    `${author.username} / ${author.displayName}`.toUpperCase(),
    { face: UI_FACES.caption, size: 26 * s, color: withAlpha(design.textColor, 0.6), letterSpacing: 0.14, maxLines: 1 },
    fonts,
    width * 0.7,
  );
  const band = bottomBand(size, insets, s, design.frame, design.padding * s);
  return { paragraph: p, x: insets.left, y: band.top + (band.height - p.getHeight()) / 2, width: width * 0.7 };
}

function buildWatermark(dark: boolean, size: Size, insets: Insets, s: number, frame: Frame, fonts: SkTypefaceFontProvider): PlacedParagraph {
  const width = 300 * s;
  const p = paragraph('DICTA', { face: UI_FACES.wordmark, size: 26 * s, color: withAlpha(dark ? CREAM : '#141414', 0.45), align: 'right', letterSpacing: 0.3 }, fonts, width);
  const right = isDeviceFrame(frame) ? 40 * s : Math.max(insets.right, 40 * s);
  // The LCD screen runs almost to the bottom edge; its dark top band is free.
  const band = frame === 'lcd' ? { top: 0, height: 0.15 * size.height } : bottomBand(size, insets, s, frame, Math.max(insets.right, 40 * s));
  return { paragraph: p, x: size.width - right - width, y: band.top + (band.height - p.getHeight()) / 2, width };
}

/** "MODE" / "SET" above the pager screen and a date counter inside it. */
function buildPagerText(size: Size, text: string, ink: string, fonts: SkTypefaceFontProvider): CardLayout['pager'] {
  const w = size.width;
  const screen = { x: 0.085 * w, y: 0.2 * size.height, width: 0.83 * w };
  const labelSize = 0.04 * w;
  const label = (value: string, align: TextAlign) =>
    paragraph(value, { face: 'ShareTechMono_400Regular', size: labelSize, color: '#D59A55', align, letterSpacing: 0.12 }, fonts, screen.width - 0.06 * w);
  const labelY = screen.y - 0.075 * w - labelSize * 0.6;
  const day = String(1 + (hashString(text) % 28)).padStart(2, '0');
  const date = paragraph(day, { face: 'ShareTechMono_400Regular', size: 0.07 * w, color: withAlpha(ink, 0.85), align: 'right' }, fonts, 0.3 * w);
  return {
    labels: [
      { paragraph: label('MODE', 'left'), x: screen.x + 0.03 * w, y: labelY, width: screen.width - 0.06 * w },
      { paragraph: label('SET', 'right'), x: screen.x + 0.03 * w, y: labelY, width: screen.width - 0.06 * w },
    ],
    date: { paragraph: date, x: screen.x + screen.width - 0.06 * w - 0.3 * w, y: screen.y + 0.03 * w, width: 0.3 * w },
  };
}
