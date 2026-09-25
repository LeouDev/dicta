import { FONT_LIBRARY, availableWeights, hasItalic, isFontKey, type FontKey, type FontWeight } from '@/constants/fonts';

import { createDesign } from './templates';
import {
  CANVASES,
  COMPOSITIONS,
  DESIGN_LIMITS,
  DESIGN_VERSION,
  FRAMES,
  SIGNATURE_MAX_LENGTH,
  TEMPLATE_IDS,
  TEXTURES,
  type Canvas,
  type CardBackground,
  type QuoteDesign,
} from './types';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const GRADIENT = /^linear-gradient\(\s*-?\d+(?:\.\d+)?deg(?:\s*,\s*#[0-9a-f]{3,8}\s+\d+(?:\.\d+)?%)+\s*\)$/i;
const ALIGNS = ['left', 'center', 'right'] as const;
const V_ALIGNS = ['top', 'center', 'bottom'] as const;
const CASES = ['none', 'uppercase'] as const;

type Raw = Record<string, unknown>;
type Limits = { min: number; max: number };

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const record = (v: unknown): Raw => (isRecord(v) ? v : {});
const num = (v: unknown, { min, max }: Limits, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fallback);
const colorOrNull = (v: unknown, fallback: string | null) => (v === null ? null : typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const oneOfOrNull = <T extends string>(v: unknown, options: readonly T[], fallback: T | null): T | null =>
  v === null ? null : options.includes(v as T) ? (v as T) : fallback;

/** Only http(s) and local file URIs are ever rendered. */
const imageUrl = (v: unknown) => (typeof v === 'string' && /^(https?|file):\/\//.test(v) ? v : null);

function weightFor(font: FontKey, value: unknown, fallback: FontWeight): FontWeight {
  const weights = availableWeights(font);
  if (weights.includes(value as FontWeight)) return value as FontWeight;
  if (typeof value !== 'number') return weights.includes(fallback) ? fallback : FONT_LIBRARY[font].defaultWeight;
  return weights.reduce((best, w) => (Math.abs(w - value) < Math.abs(best - value) ? w : best));
}

function parseBackground(v: unknown, base: CardBackground): CardBackground {
  const raw = record(v);
  const type = oneOf(raw.type, ['solid', 'gradient', 'image', 'split'] as const, base.type);
  return {
    type,
    color: color(raw.color, base.color),
    color2: color(raw.color2, base.color2),
    angle: num(raw.angle, DESIGN_LIMITS.angle, base.angle),
    image: imageUrl(raw.image),
    ...(typeof raw.path === 'string' ? { path: raw.path } : {}),
    overlay: oneOf(raw.overlay, ['off', 'auto', 'strong'] as const, base.overlay),
  };
}

// --- Version 1 (1000-unit canvas, flat fields) → version 2 ----------------------------------
const V1_FONTS: Record<string, FontKey> = {
  // DM Serif Display was v1's Editorial face; v2 calls it Display.
  editorial: 'display',
  elegant: 'elegant',
  classic: 'classic',
  modern: 'modern',
  minimal: 'modern',
  bold: 'bold',
  typewriter: 'typewriter',
  handwritten: 'hand',
};
const V1_CANVAS: Record<string, Canvas> = { portrait: '4:5', square: '1:1', story: '9:16' };
const V1_UNITS = 1.08;
const scaled = (v: unknown) => (typeof v === 'number' ? v * V1_UNITS : undefined);

function fromV1(v: Raw): Raw {
  const bg = record(v.background);
  const colors = Array.isArray(bg.colors) ? bg.colors : [];
  const dim = typeof bg.dim === 'number' ? bg.dim : 0.45;
  const background =
    bg.type === 'gradient'
      ? { type: 'gradient', color: colors[0], color2: colors[colors.length - 1], angle: bg.angle }
      : bg.type === 'image'
        ? { type: 'image', image: bg.uri, path: bg.path, overlay: dim >= 0.6 ? 'strong' : dim > 0.05 ? 'auto' : 'off' }
        : { type: 'solid', color: bg.color };
  return {
    template: v.template,
    font: typeof v.fontFamily === 'string' ? V1_FONTS[v.fontFamily] : undefined,
    weight: v.fontWeight,
    size: scaled(v.fontSize),
    lineHeight: v.lineHeight,
    letterSpacing: v.letterSpacing,
    curve: v.curve,
    textColor: v.textColor,
    background,
    texture: { type: v.texture === 'noise' ? 'grain' : v.texture, strength: v.textureIntensity },
    align: v.textAlign,
    vAlign: v.verticalAlign,
    padding: scaled(v.padding),
    textWidth: v.textWidth,
    canvas: typeof v.format === 'string' ? V1_CANVAS[v.format] : undefined,
    header: {
      show: v.showProfile,
      avatar: v.showAvatar,
      username: v.showUsername,
      verified: v.showVerifiedBadge,
      // v1 stored the avatar diameter; v2's header is 190 units at scale 1.
      scale: typeof v.headerSize === 'number' ? (v.headerSize * V1_UNITS) / 190 : undefined,
    },
    signature: { show: v.showSignature, text: v.signature },
  };
}

/**
 * Turns untrusted JSON (from the database, a draft, or an old app version) into
 * a complete, valid design. Version 1 designs are upgraded. Anything missing or
 * invalid falls back to the template's value, and numbers are clamped.
 */
export function parseQuoteDesign(input: unknown): QuoteDesign {
  const source = record(input);
  const raw = source.version === DESIGN_VERSION || 'font' in source ? source : fromV1(source);
  const template = oneOf(raw.template, TEMPLATE_IDS, 'editorial');
  const base = createDesign(template);

  const font = isFontKey(raw.font) ? raw.font : base.font;
  const background = parseBackground(raw.background, base.background);
  const texture = record(raw.texture);
  const header = record(raw.header);
  const signature = record(raw.signature);

  return {
    version: DESIGN_VERSION,
    template,
    font,
    weight: weightFor(font, raw.weight, base.weight),
    italic: hasItalic(font) && bool(raw.italic, base.italic),
    size: num(raw.size, DESIGN_LIMITS.size, base.size),
    lineHeight: num(raw.lineHeight, DESIGN_LIMITS.lineHeight, base.lineHeight),
    letterSpacing: num(raw.letterSpacing, DESIGN_LIMITS.letterSpacing, base.letterSpacing),
    textTransform: oneOf(raw.textTransform, CASES, base.textTransform),
    curve: num(raw.curve, DESIGN_LIMITS.curve, base.curve),
    textColor: color(raw.textColor, base.textColor),
    textFill: raw.textFill === null ? null : typeof raw.textFill === 'string' && GRADIENT.test(raw.textFill) ? raw.textFill : base.textFill,
    glow: raw.glow === null ? null : typeof raw.glow === 'string' && (RGBA.test(raw.glow) || HEX.test(raw.glow)) ? raw.glow : base.glow,
    background,
    texture: {
      type: oneOf(texture.type, TEXTURES, base.texture.type),
      strength: num(texture.strength, DESIGN_LIMITS.strength, base.texture.strength),
    },
    align: oneOf(raw.align, ALIGNS, base.align),
    blockAlign: oneOfOrNull(raw.blockAlign, ALIGNS, base.blockAlign),
    vAlign: oneOf(raw.vAlign, V_ALIGNS, base.vAlign),
    padding: num(raw.padding, DESIGN_LIMITS.padding, base.padding),
    topOffset: num(raw.topOffset, DESIGN_LIMITS.topOffset, base.topOffset),
    textWidth: num(raw.textWidth, DESIGN_LIMITS.textWidth, base.textWidth),
    canvas: oneOf(raw.canvas, Object.keys(CANVASES) as Canvas[], base.canvas),
    radius: num(raw.radius, DESIGN_LIMITS.radius, base.radius),
    composition: oneOf(raw.composition, COMPOSITIONS, base.composition),
    kickerScale: num(raw.kickerScale, DESIGN_LIMITS.kickerScale, base.kickerScale),
    kickerColor: colorOrNull(raw.kickerColor, base.kickerColor),
    secondTransform: oneOfOrNull(raw.secondTransform, CASES, base.secondTransform),
    colGap: num(raw.colGap, DESIGN_LIMITS.colGap, base.colGap),
    highlight: color(raw.highlight, base.highlight),
    highlightText: colorOrNull(raw.highlightText, base.highlightText),
    frame: oneOf(raw.frame, FRAMES, base.frame),
    footer: bool(raw.footer, base.footer),
    header: {
      show: bool(header.show, base.header.show),
      avatar: bool(header.avatar, base.header.avatar),
      name: bool(header.name, base.header.name),
      username: bool(header.username, base.header.username),
      verified: bool(header.verified, base.header.verified),
      position: oneOf(header.position, ['top-left', 'top-center'] as const, base.header.position),
      scale: num(header.scale, DESIGN_LIMITS.headerScale, base.header.scale),
    },
    signature: {
      show: bool(signature.show, base.signature.show),
      text: typeof signature.text === 'string' ? signature.text.slice(0, SIGNATURE_MAX_LENGTH) : base.signature.text,
      style: oneOf(signature.style, ['script', 'serif', 'caps', 'note'] as const, base.signature.style),
    },
  };
}
