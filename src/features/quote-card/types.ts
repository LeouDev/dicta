import type { FontId, FontWeight } from '@/constants/fonts';

/**
 * Designs are authored on a virtual canvas 1000 units wide. Every size in a
 * QuoteDesign (font size, padding, header size…) is in these units, so the same
 * design renders identically at 358pt in the feed or 1080px in an export.
 */
export const DESIGN_WIDTH = 1000;
export const DESIGN_VERSION = 1;

/** width / height */
export const CARD_FORMATS = {
  portrait: { label: '4:5', ratio: 4 / 5 },
  square: { label: '1:1', ratio: 1 },
  story: { label: '9:16', ratio: 9 / 16 },
} as const;
export type CardFormat = keyof typeof CARD_FORMATS;

export const TEXTURES = ['none', 'paper', 'grain', 'noise', 'canvas', 'film'] as const;
export type TextureId = (typeof TEXTURES)[number];

export const TEMPLATE_IDS = [
  'editorial',
  'minimal',
  'midnight',
  'typewriter',
  'journal',
  'modern',
  'gradient',
  'photograph',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'center' | 'bottom';

export type CardBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; colors: string[]; angle: number }
  /** `uri` is a local file while drafting and a public URL once published; `path` is the storage key. */
  | { type: 'image'; uri: string | null; path?: string; dim: number };

export interface QuoteDesign {
  version: typeof DESIGN_VERSION;
  template: TemplateId;
  format: CardFormat;

  fontFamily: FontId;
  /** Design units; the renderer may shrink text to fit, never grow it. */
  fontSize: number;
  fontWeight: FontWeight;
  /** In em, so spacing scales with the font size. */
  letterSpacing: number;
  /** Line height multiplier. */
  lineHeight: number;
  textAlign: TextAlign;
  textColor: string;
  /** Name, handle and signature color. */
  metaColor: string;

  background: CardBackground;
  texture: TextureId;
  textureIntensity: number;

  verticalAlign: VerticalAlign;
  padding: number;
  /** Fraction of the content width the quote may use. */
  textWidth: number;
  /** 0–1: how much each line tilts, for the hand-set editorial look. */
  curve: number;

  showProfile: boolean;
  showAvatar: boolean;
  showUsername: boolean;
  showVerifiedBadge: boolean;
  /** Avatar diameter in design units. */
  headerSize: number;
  showSignature: boolean;
  signature: string;
}

/** Slider ranges and clamping bounds, shared by the editor and the parser. */
export const DESIGN_LIMITS = {
  fontSize: { min: 32, max: 170 },
  letterSpacing: { min: -0.08, max: 0.3 },
  lineHeight: { min: 0.8, max: 1.9 },
  padding: { min: 40, max: 200 },
  textWidth: { min: 0.5, max: 1 },
  curve: { min: 0, max: 1 },
  textureIntensity: { min: 0, max: 1 },
  headerSize: { min: 60, max: 260 },
  dim: { min: 0, max: 0.85 },
  angle: { min: 0, max: 360 },
} as const;

export const TEXT_MAX_LENGTH = 500;

/** Identity shown in the card header. Kept out of the design so a new avatar updates old cards. */
export interface CardAuthor {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
}
