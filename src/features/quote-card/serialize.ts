import { FONT_LIBRARY, availableWeights, isFontId, type FontWeight } from '@/constants/fonts';

import { createDesign } from './templates';
import {
  CARD_FORMATS,
  DESIGN_LIMITS,
  DESIGN_VERSION,
  TEMPLATE_IDS,
  TEXTURES,
  type CardBackground,
  type CardFormat,
  type QuoteDesign,
} from './types';

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FORMATS = Object.keys(CARD_FORMATS) as CardFormat[];

type Raw = Record<string, unknown>;
type Limits = { min: number; max: number };

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const clamp = (v: number, { min, max }: Limits) => Math.min(max, Math.max(min, v));
const num = (v: unknown, limits: Limits, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, limits) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

function parseBackground(v: unknown, fallback: CardBackground): CardBackground {
  if (!isRecord(v)) return fallback;
  if (v.type === 'solid') return { type: 'solid', color: color(v.color, '#FAF8F3') };
  if (v.type === 'gradient') {
    const colors = Array.isArray(v.colors) ? v.colors.filter((c): c is string => typeof c === 'string' && HEX.test(c)) : [];
    return {
      type: 'gradient',
      colors: colors.length >= 2 ? colors.slice(0, 4) : ['#FBD3C1', '#E4C8F2'],
      angle: num(v.angle, DESIGN_LIMITS.angle, 135),
    };
  }
  if (v.type === 'image') {
    // Only http(s) and local file URIs are ever rendered.
    const uri = typeof v.uri === 'string' && /^(https?|file):\/\//.test(v.uri) ? v.uri : null;
    return {
      type: 'image',
      uri,
      path: typeof v.path === 'string' ? v.path : undefined,
      dim: num(v.dim, DESIGN_LIMITS.dim, 0.45),
    };
  }
  return fallback;
}

/**
 * Turns untrusted JSON (from the database, a draft, or an old app version)
 * into a complete, valid design. Anything missing or invalid falls back to the
 * template's default, and numbers are clamped to the editor's ranges.
 */
export function parseQuoteDesign(input: unknown): QuoteDesign {
  const raw = isRecord(input) ? input : {};
  const template = oneOf(raw.template, TEMPLATE_IDS, 'editorial');
  const base = createDesign(template);

  const fontFamily = typeof raw.fontFamily === 'string' && isFontId(raw.fontFamily) ? raw.fontFamily : base.fontFamily;
  const weights = availableWeights(fontFamily);
  const fontWeight: FontWeight = weights.includes(raw.fontWeight as FontWeight)
    ? (raw.fontWeight as FontWeight)
    : fontFamily === base.fontFamily
      ? base.fontWeight
      : FONT_LIBRARY[fontFamily].defaultWeight;

  return {
    version: DESIGN_VERSION,
    template,
    format: oneOf(raw.format, FORMATS, base.format),
    fontFamily,
    fontWeight,
    fontSize: num(raw.fontSize, DESIGN_LIMITS.fontSize, base.fontSize),
    letterSpacing: num(raw.letterSpacing, DESIGN_LIMITS.letterSpacing, base.letterSpacing),
    lineHeight: num(raw.lineHeight, DESIGN_LIMITS.lineHeight, base.lineHeight),
    textAlign: oneOf(raw.textAlign, ['left', 'center', 'right'] as const, base.textAlign),
    textColor: color(raw.textColor, base.textColor),
    metaColor: color(raw.metaColor, base.metaColor),
    background: parseBackground(raw.background, base.background),
    texture: oneOf(raw.texture, TEXTURES, base.texture),
    textureIntensity: num(raw.textureIntensity, DESIGN_LIMITS.textureIntensity, base.textureIntensity),
    verticalAlign: oneOf(raw.verticalAlign, ['top', 'center', 'bottom'] as const, base.verticalAlign),
    padding: num(raw.padding, DESIGN_LIMITS.padding, base.padding),
    textWidth: num(raw.textWidth, DESIGN_LIMITS.textWidth, base.textWidth),
    curve: num(raw.curve, DESIGN_LIMITS.curve, base.curve),
    showProfile: bool(raw.showProfile, base.showProfile),
    showAvatar: bool(raw.showAvatar, base.showAvatar),
    showUsername: bool(raw.showUsername, base.showUsername),
    showVerifiedBadge: bool(raw.showVerifiedBadge, base.showVerifiedBadge),
    headerSize: num(raw.headerSize, DESIGN_LIMITS.headerSize, base.headerSize),
    showSignature: bool(raw.showSignature, base.showSignature),
    signature: typeof raw.signature === 'string' ? raw.signature.slice(0, 60) : base.signature,
  };
}
