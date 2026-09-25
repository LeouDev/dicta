import {
  Skia,
  TextAlign as SkTextAlign,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { resolveFontFace } from '@/constants/fonts';

import {
  alignBlock,
  cardSize,
  contentInsets,
  hashString,
  initials,
  largestFittingScale,
  lineTilts,
  unitScale,
  withAlpha,
  type Size,
} from './geometry';
import type { CardAuthor, CardBackground, CardFormat, QuoteDesign, TextAlign, TextureId } from './types';

export interface PlacedParagraph {
  paragraph: SkParagraph;
  x: number;
  y: number;
  width: number;
}

export interface PlacedLine extends PlacedParagraph {
  /** Radians, around `pivot`. */
  angle: number;
  pivot: { x: number; y: number };
}

export interface CardLayout extends Size {
  scale: number;
  seed: number;
  background: CardBackground;
  texture: TextureId;
  textureIntensity: number;
  header: {
    avatar: { x: number; y: number; size: number; initials: PlacedParagraph; ring: string } | null;
    name: PlacedParagraph;
    handle: PlacedParagraph | null;
    badge: { x: number; y: number; size: number } | null;
  } | null;
  lines: PlacedLine[];
  signature: PlacedParagraph | null;
  watermark: PlacedParagraph | null;
}

export interface LayoutInput {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  /** Pixel width; height follows from the format. */
  width: number;
  /** Render in a different format than the design's own (exports). */
  format?: CardFormat;
  fonts: SkTypefaceFontProvider;
  watermark?: boolean;
}

const SK_ALIGN: Record<TextAlign, SkTextAlign> = {
  left: SkTextAlign.Left,
  center: SkTextAlign.Center,
  right: SkTextAlign.Right,
};

const UNLIMITED = 100_000;

interface TextOptions {
  face: string;
  size: number;
  color: string;
  align?: TextAlign;
  letterSpacing?: number;
  lineHeight?: number;
  maxLines?: number;
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
  });
  builder.addText(text);
  const p = builder.build();
  p.layout(width);
  return p;
}

/**
 * Lays out a quote card at a concrete pixel size. Pure function of its
 * inputs: the feed, the editor preview and every export call it with the same
 * design and only the size/format changes. Text shrinks to fit (never grows),
 * and stories keep clear of Instagram's UI.
 */
export function layoutCard({ text, design, author, width, format = design.format, fonts, watermark = false }: LayoutInput): CardLayout {
  const size = cardSize(format, width);
  const s = unitScale(width);
  const insets = contentInsets(format, size, design.padding * s);
  const contentWidth = size.width - insets.left - insets.right;
  const contentHeight = size.height - insets.top - insets.bottom;
  const textWidth = contentWidth * design.textWidth;
  const textX = insets.left + (design.textAlign === 'left' ? 0 : design.textAlign === 'center' ? (contentWidth - textWidth) / 2 : contentWidth - textWidth);
  const quoteFace = resolveFontFace(design.fontFamily, design.fontWeight);
  const body = text.trim() || ' ';
  const seed = hashString(body);

  // --- Header -------------------------------------------------------------
  const header = design.showProfile ? buildHeader(design, author, s, contentWidth, fonts) : null;
  const headerGap = header ? 48 * s : 0;

  // --- Quote text: largest font scale that fits ----------------------------
  const signatureText = design.showSignature ? design.signature.trim() || `— ${author.displayName}` : '';
  const measure = (fit: number) => {
    const fontSize = design.fontSize * s * fit;
    const quote = paragraph(
      body,
      { face: quoteFace, size: fontSize, color: design.textColor, align: design.textAlign, letterSpacing: design.letterSpacing, lineHeight: design.lineHeight },
      fonts,
      textWidth,
    );
    const signature = signatureText
      ? paragraph(signatureText, { face: quoteFace, size: Math.max(fontSize * 0.42, 26 * s), color: design.metaColor, align: design.textAlign }, fonts, textWidth)
      : null;
    const signatureGap = signature ? fontSize * 0.7 : 0;
    const height = (header?.height ?? 0) + headerGap + quote.getHeight() + signatureGap + (signature?.getHeight() ?? 0);
    return { fontSize, quote, signature, signatureGap, height };
  };
  let result = measure(1);
  if (result.height > contentHeight) {
    const fit = largestFittingScale((f) => measure(f).height <= contentHeight);
    result = measure(fit);
  }
  const { fontSize, quote, signature, signatureGap } = result;

  // --- Vertical placement of the whole group ------------------------------
  let y = alignBlock(design.verticalAlign, insets.top, contentHeight, result.height);
  const placedHeader = header ? header.place(insets.left, contentWidth, y, design.textAlign) : null;
  y += (header?.height ?? 0) + headerGap;

  const lines = placeLines(body, quote, {
    x: textX,
    y,
    width: textWidth,
    fontSize,
    curve: design.curve,
    seed,
    style: { face: quoteFace, size: fontSize, color: design.textColor, letterSpacing: design.letterSpacing, lineHeight: design.lineHeight },
    fonts,
  });
  y += quote.getHeight() + signatureGap;

  return {
    ...size,
    scale: s,
    seed,
    background: design.background,
    texture: design.texture,
    textureIntensity: design.textureIntensity,
    header: placedHeader,
    lines,
    signature: signature ? { paragraph: signature, x: textX, y, width: textWidth } : null,
    watermark: watermark ? buildWatermark(design, size, s, insets.right, fonts) : null,
  };
}

function buildHeader(design: QuoteDesign, author: CardAuthor, s: number, contentWidth: number, fonts: SkTypefaceFontProvider) {
  const avatarSize = design.showAvatar ? design.headerSize * s : 0;
  const nameSize = avatarSize ? Math.max(avatarSize * 0.19, 30 * s) : design.headerSize * 0.36 * s;
  const handleSize = nameSize * 0.86;
  const gap = avatarSize ? avatarSize * 0.14 : 0;
  const badgeSize = design.showVerifiedBadge && author.isVerified ? nameSize * 0.92 : 0;
  const textWidth = Math.max(40, contentWidth - avatarSize - gap - badgeSize * 1.3);

  const name = paragraph(author.displayName, { face: 'Inter_700Bold', size: nameSize, color: design.metaColor, maxLines: 1 }, fonts, textWidth);
  const handle = design.showUsername
    ? paragraph(`@${author.username}`, { face: 'Inter_400Regular', size: handleSize, color: withAlpha(design.metaColor, 0.62), maxLines: 1 }, fonts, textWidth)
    : null;
  const textBlock = name.getHeight() + (handle ? handle.getHeight() + nameSize * 0.08 : 0);
  const height = Math.max(avatarSize, textBlock);

  const place = (left: number, width: number, top: number, align: TextAlign) => {
    // With an avatar the header anchors to the side the text starts from;
    // without one it simply follows the text alignment.
    const side = align === 'right' ? 'right' : avatarSize || align === 'left' ? 'left' : 'center';
    const nameWidth = name.getLongestLine();
    const rowWidth = avatarSize + gap + Math.max(nameWidth + badgeSize * 1.3, handle?.getLongestLine() ?? 0);
    const rowX = side === 'left' ? left : side === 'right' ? left + width - rowWidth : left + (width - rowWidth) / 2;
    const textX = rowX + (side === 'right' ? 0 : avatarSize + gap);
    const textTop = top + (height - textBlock) / 2;
    const handleTop = textTop + name.getHeight() + nameSize * 0.08;

    const avatarX = side === 'right' ? rowX + rowWidth - avatarSize : rowX;
    const avatarY = top + (height - avatarSize) / 2;
    const monogram = avatarSize
      ? paragraph(initials(author.displayName), { face: 'DMSerifDisplay_400Regular', size: avatarSize * 0.4, color: design.metaColor, align: 'center' }, fonts, avatarSize)
      : null;

    return {
      avatar: monogram
        ? {
            x: avatarX,
            y: avatarY,
            size: avatarSize,
            initials: { paragraph: monogram, x: avatarX, y: avatarY + (avatarSize - monogram.getHeight()) / 2, width: avatarSize },
            ring: withAlpha(design.metaColor, 0.12),
          }
        : null,
      name: { paragraph: name, x: textX, y: textTop, width: textWidth },
      handle: handle ? { paragraph: handle, x: textX, y: handleTop, width: textWidth } : null,
      badge: badgeSize
        ? { x: textX + nameWidth + badgeSize * 0.3, y: textTop + (name.getHeight() - badgeSize) / 2, size: badgeSize }
        : null,
    };
  };

  return { height, place };
}

interface PlaceLinesOptions {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  curve: number;
  seed: number;
  style: TextOptions;
  fonts: SkTypefaceFontProvider;
}

/**
 * Without curve, the quote is one paragraph. With curve, each laid-out line is
 * re-set as its own paragraph so it can tilt independently, while keeping the
 * original line breaks, alignment and baselines.
 */
function placeLines(text: string, quote: SkParagraph, o: PlaceLinesOptions): PlacedLine[] {
  if (o.curve < 0.02) {
    return [{ paragraph: quote, x: o.x, y: o.y, width: o.width, angle: 0, pivot: { x: 0, y: 0 } }];
  }
  // React Native Skia reports line ranges as UTF-16 indices, i.e. JS string positions.
  const metrics = quote.getLineMetrics();
  const tilts = lineTilts(metrics.length, o.seed, o.curve, o.fontSize, o.width);

  return metrics.flatMap((m, i) => {
    const lineText = text.slice(m.startIndex, m.endExcludingWhitespaces);
    if (!lineText.trim()) return [];
    const line = paragraph(lineText, { ...o.style, align: 'left' }, o.fonts, UNLIMITED);
    const lineWidth = Math.ceil(line.getLongestLine()) + 2;
    const baseline = line.getLineMetrics()[0]?.baseline ?? m.baseline;
    const x = o.x + m.left + tilts[i].dx;
    const y = o.y + m.baseline - baseline + tilts[i].dy;
    return [
      {
        paragraph: line,
        x,
        y,
        width: lineWidth,
        angle: tilts[i].angle,
        pivot: { x: x + m.width / 2, y: o.y + m.baseline - m.ascent / 2 + tilts[i].dy },
      },
    ];
  });
}

function buildWatermark(design: QuoteDesign, size: Size, s: number, right: number, fonts: SkTypefaceFontProvider): PlacedParagraph {
  const width = 300 * s;
  const p = paragraph('DICTA', { face: 'CormorantGaramond_600SemiBold', size: 24 * s, color: withAlpha(design.metaColor, 0.45), align: 'right', letterSpacing: 0.3 }, fonts, width);
  return { paragraph: p, x: size.width - right - width, y: size.height - 40 * s - p.getHeight(), width };
}
