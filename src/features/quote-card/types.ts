import type { FontKey, FontWeight } from '@/constants/fonts';

/**
 * Designs are authored on a virtual canvas 1080 units wide. Every size in a
 * QuoteDesign (font size, padding, radius, header metrics…) is in these units,
 * so the same design renders identically at 358pt in the feed or 1080px in an export.
 */
export const DESIGN_WIDTH = 1080;
export const DESIGN_VERSION = 2;

/** The design's own aspect ratio, width / height. */
export const CANVASES = {
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '1:1': 1,
} as const;
export type Canvas = keyof typeof CANVASES;

/** How a card is rendered: as designed, or re-laid out for an export size. */
export const FORMATS = ['original', 'story', 'post', 'square'] as const;
export type Format = (typeof FORMATS)[number];

export const TEXTURES = [
  'none',
  'paper',
  'grain',
  'heavygrain',
  'canvas',
  'film',
  'lined',
  'bookpage',
  'concrete',
  'mottle',
  'scanlines',
] as const;
export type TextureKey = (typeof TEXTURES)[number];

export const COMPOSITIONS = ['flow', 'kicker', 'columns', 'highlight'] as const;
export type Composition = (typeof COMPOSITIONS)[number];

export const FRAMES = ['none', 'pager', 'lcd', 'notification'] as const;
export type Frame = (typeof FRAMES)[number];

export const TEMPLATE_IDS = [
  'editorial',
  'minimal',
  'midnight',
  'typewriter',
  'journal',
  'modern',
  'gradient',
  'photograph',
  'diptych',
  'headline',
  'grain',
  'pager',
  'lcd',
  'ink',
  'wall',
  'notification',
  'book',
  'dialogue',
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'center' | 'bottom';
export type TextTransform = 'none' | 'uppercase';
export type Overlay = 'off' | 'auto' | 'strong';
export type SignatureStyle = 'script' | 'serif' | 'caps' | 'note';

export interface CardBackground {
  type: 'solid' | 'gradient' | 'image' | 'split';
  color: string;
  color2: string;
  /** CSS angle: 0° points up, 90° right. */
  angle: number;
  /** Photo URL: a local file while drafting, a public URL once published. */
  image: string | null;
  /** Storage key of an uploaded photo, so it can be removed with the post. */
  path?: string;
  overlay: Overlay;
}

export interface QuoteDesign {
  version: typeof DESIGN_VERSION;
  template: TemplateId;
  font: FontKey;
  weight: FontWeight;
  italic: boolean;
  /** Largest font size in design units; the renderer shrinks it to fit. */
  size: number;
  lineHeight: number;
  /** In em. */
  letterSpacing: number;
  textTransform: TextTransform;
  /** 0–1 "editorial wave": each word tilts and bobs a little. */
  curve: number;
  textColor: string;
  /** CSS linear-gradient() for gradient-filled text, e.g. Headline. */
  textFill: string | null;
  /** rgba() glow behind the text, e.g. LCD. */
  glow: string | null;
  background: CardBackground;
  texture: { type: TextureKey; strength: number };
  align: TextAlign;
  /** Where the text block sits when it differs from the text alignment. */
  blockAlign: TextAlign | null;
  vAlign: VerticalAlign;
  /** Design units (top uses 0.85×). */
  padding: number;
  /** Fraction of the height added to the top padding. */
  topOffset: number;
  /** 0.5–1 of the content width. */
  textWidth: number;
  canvas: Canvas;
  /** Corner radius in design units, feed only (exports are square). */
  radius: number;
  composition: Composition;
  kickerScale: number;
  kickerColor: string | null;
  /** Columns: the second paragraph's case. */
  secondTransform: TextTransform | null;
  /** Design units, columns only. */
  colGap: number;
  highlight: string;
  highlightText: string | null;
  frame: Frame;
  /** "HANDLE / NAME" caption, bottom left. */
  footer: boolean;
  header: {
    show: boolean;
    avatar: boolean;
    name: boolean;
    username: boolean;
    verified: boolean;
    position: 'top-left' | 'top-center';
    scale: number;
  };
  signature: { show: boolean; text: string; style: SignatureStyle };
}

/** Slider ranges and clamping bounds, shared by the editor and the parser. */
export const DESIGN_LIMITS = {
  size: { min: 28, max: 240 },
  lineHeight: { min: 0.8, max: 1.9 },
  letterSpacing: { min: -0.08, max: 0.3 },
  curve: { min: 0, max: 1 },
  strength: { min: 0, max: 1 },
  padding: { min: 0, max: 220 },
  topOffset: { min: 0, max: 0.4 },
  textWidth: { min: 0.5, max: 1 },
  radius: { min: 0, max: 80 },
  kickerScale: { min: 0.2, max: 1 },
  colGap: { min: 0, max: 200 },
  angle: { min: 0, max: 360 },
  headerScale: { min: 0.5, max: 1.5 },
} as const;

export const TEXT_MAX_LENGTH = 500;
export const SIGNATURE_MAX_LENGTH = 60;

/** Identity shown in the card header. Kept out of the design so a new avatar updates old cards. */
export interface CardAuthor {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
}
