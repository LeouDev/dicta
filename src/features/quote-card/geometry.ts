/**
 * Pure layout math for quote cards: no Skia, so it runs (and is tested) anywhere.
 */
import { CARD_FORMATS, DESIGN_WIDTH, type CardFormat } from './types';

export interface Size {
  width: number;
  height: number;
}

export function cardSize(format: CardFormat, width: number): Size {
  return { width, height: Math.round(width / CARD_FORMATS[format].ratio) };
}

/** Pixels per design unit for a card rendered `width` pixels wide. */
export const unitScale = (width: number) => width / DESIGN_WIDTH;

/**
 * Content insets in px. Stories reserve Instagram's top and bottom UI zones,
 * so the same design adapts instead of hiding under the reply bar.
 */
export function contentInsets(format: CardFormat, size: Size, paddingPx: number) {
  if (format === 'story') {
    return {
      left: paddingPx,
      right: paddingPx,
      top: Math.max(paddingPx, size.height * 0.13),
      bottom: Math.max(paddingPx, size.height * 0.16),
    };
  }
  return { left: paddingPx, right: paddingPx, top: paddingPx, bottom: paddingPx };
}

/** Where a block of `blockHeight` sits inside the available area. */
export function alignBlock(align: 'top' | 'center' | 'bottom', top: number, available: number, blockHeight: number) {
  if (align === 'top') return top;
  if (align === 'bottom') return top + available - blockHeight;
  // Optical center sits slightly above the geometric one.
  return top + (available - blockHeight) / 2 - Math.max(0, available - blockHeight) * 0.06;
}

/** Stable 32-bit hash so a post's hand-set tilt never changes between renders. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LineTilt {
  /** Radians. */
  angle: number;
  dx: number;
  dy: number;
}

// Wide lines amplify tilt at their ends; 1.5° keeps neighbors from touching at tight leading.
const MAX_TILT = (1.5 * Math.PI) / 180;

/**
 * The editorial "hand-set" look: each line tilts a little, alternating
 * direction, with a touch of drift. Deterministic for a given seed.
 */
export function lineTilts(count: number, seed: number, curve: number, fontSizePx: number, blockWidth: number): LineTilt[] {
  const rand = mulberry32(seed);
  const firstSign = rand() < 0.5 ? -1 : 1;
  return Array.from({ length: count }, (_, i) => {
    const sign = i % 2 === 0 ? firstSign : -firstSign;
    return {
      angle: curve * MAX_TILT * sign * (0.35 + 0.65 * rand()),
      dx: curve * (rand() - 0.5) * 0.02 * blockWidth,
      dy: curve * (rand() - 0.5) * 0.035 * fontSizePx,
    };
  });
}

/**
 * Largest scale in [min, 1] for which `fits(scale)` holds, found by binary
 * search. Returns 1 immediately in the common case where everything fits.
 */
export function largestFittingScale(fits: (scale: number) => boolean, min = 0.4, iterations = 8): number {
  if (fits(1)) return 1;
  let lo = min;
  let hi = 1;
  if (!fits(lo)) return lo;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Direction for a CSS-style gradient angle (0° = to top, 90° = to right). */
export function gradientPoints(angleDeg: number, { width, height }: Size) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return {
    start: { x: cx - dx * half, y: cy - dy * half },
    end: { x: cx + dx * half, y: cy + dy * half },
  };
}

/** "#RRGGBB" + alpha 0–1 → "#RRGGBBAA". */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}
