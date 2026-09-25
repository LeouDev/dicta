/**
 * Pure layout math for quote cards: no Skia, so it runs (and is tested) anywhere.
 * Values follow Templates.md; sizes are px unless a name says otherwise.
 */
import { CANVASES, DESIGN_WIDTH, type Canvas, type Format, type Frame, type Overlay, type VerticalAlign } from './types';

export interface Size {
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FORMAT_RATIO: Record<Exclude<Format, 'original'>, number> = { story: 9 / 16, post: 4 / 5, square: 1 };

/** width / height of a card rendered in `format` ("original" keeps the design's canvas). */
export const formatRatio = (format: Format, canvas: Canvas) => (format === 'original' ? CANVASES[canvas] : FORMAT_RATIO[format]);

export function cardSize(format: Format, canvas: Canvas, width: number): Size {
  return { width, height: Math.round(width / formatRatio(format, canvas)) };
}

/** Pixels per design unit for a card rendered `width` pixels wide. */
export const unitScale = (width: number) => width / DESIGN_WIDTH;

export const isDeviceFrame = (frame: Frame) => frame === 'pager' || frame === 'lcd';

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Where text may go. Padding is in design units (the top uses 0.85×, plus
 * topOffset of the height). Device frames place text on their screen, and
 * stories keep clear of Instagram's top and bottom UI (except device frames).
 */
export function contentInsets(o: { format: Format; frame: Frame; size: Size; scale: number; padding: number; topOffset: number }): Insets {
  const { width: w, height: h } = o.size;
  if (o.frame === 'pager') {
    return { top: 0.2 * h + 0.14 * w, left: 0.145 * w, right: 0.145 * w, bottom: 0.3 * h + 0.05 * w };
  }
  if (o.frame === 'lcd') {
    return { top: 0.33 * h + 0.07 * w, left: 0.1 * w, right: 0.14 * w, bottom: 0.025 * h + 0.05 * w };
  }
  const pad = o.padding * o.scale;
  const story = o.format === 'story';
  return {
    left: pad,
    right: pad,
    top: pad * 0.85 + h * o.topOffset + (story ? 0.1 * h : 0),
    bottom: pad + (story ? 0.13 * h : 0),
  };
}

/** Top of a block of `blockHeight` inside the available space. */
export function alignBlock(align: VerticalAlign, top: number, available: number, blockHeight: number) {
  if (align === 'top') return top;
  if (align === 'bottom') return top + available - blockHeight;
  return top + (available - blockHeight) / 2;
}

/**
 * The largest font size in [20% of base, hiScale × base] for which `fits`
 * holds, by binary search. Stops once the window is under
 * max(0.2px, 0.6% of base). Returns the lower bound if nothing fits.
 */
export function fitSize(base: number, fits: (size: number) => boolean, hiScale = 1): number {
  let hi = base * hiScale;
  if (fits(hi)) return hi;
  let lo = base * 0.2;
  if (!fits(lo)) return lo;
  const window = Math.max(0.2, base * 0.006);
  while (hi - lo > window) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The editorial wave for word `i`: a small rotation (degrees) and a vertical bob (em). */
export function wave(i: number, curve: number) {
  return { rotate: curve * 5 * Math.sin(i * 2.3 + 1.1), dy: curve * 0.08 * Math.cos(i * 1.7) };
}

/** Stable 32-bit hash, for deterministic decoration (texture seeds, pager date). */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The torn-paper strip of a split background: a band 6% of the width, centered,
 * with jagged edges (60 points per edge, sinusoidal drift plus jitter).
 * Returns a closed polygon, clockwise from the top of the left edge.
 */
export function tornStrip({ width: w, height: h }: Size): { x: number; y: number }[] {
  const points = 60;
  const half = w * 0.03;
  const jitter = (i: number, side: number) => {
    const t = Math.sin(i * 12.9898 + side * 78.233) * 43758.5453;
    return t - Math.floor(t) - 0.5;
  };
  const edge = (side: number) =>
    Array.from({ length: points }, (_, i) => {
      const y = (i / (points - 1)) * h;
      const drift = Math.sin(i * 0.55 + side * 2.1) * w * 0.006 + Math.sin(i * 1.9 + side) * w * 0.003 + jitter(i, side) * w * 0.007;
      return { x: w / 2 + side * half + drift, y };
    });
  return [...edge(-1), ...edge(1).reverse()];
}

/**
 * Readability overlay for photos: a vertical gradient (10% → 26% → 62%),
 * black under light text and white under dark text, reversed when the text
 * sits at the top. "strong" is 1.4× as dense.
 */
export function overlayStops(overlay: Overlay, vAlign: VerticalAlign, darkText: boolean) {
  if (overlay === 'off') return null;
  const k = overlay === 'strong' ? 1.4 : 1;
  const alphas = [0.1, 0.26, 0.62].map((a) => Math.min(0.92, a * k));
  if (vAlign === 'top') alphas.reverse();
  const base = darkText ? '#FFFFFF' : '#000000';
  return { colors: alphas.map((a) => withAlpha(base, a)), positions: [0, 0.5, 1] };
}

/** Direction for a CSS-style gradient angle (0° = to top, 90° = to right) across a box. */
export function gradientPoints(angleDeg: number, { width, height }: Size, origin = { x: 0, y: 0 }) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = origin.x + width / 2;
  const cy = origin.y + height / 2;
  return {
    start: { x: cx - dx * half, y: cy - dy * half },
    end: { x: cx + dx * half, y: cy + dy * half },
  };
}

/** Parses `linear-gradient(90deg, #111 0%, #8e8e8e 28%, …)` (hex stops only). */
export function parseLinearGradient(css: string): { angle: number; colors: string[]; positions: number[] } | null {
  const match = /^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,(.+)\)$/i.exec(css.trim());
  if (!match) return null;
  const stops = match[2].split(',').map((s) => /^\s*(#[0-9a-f]{3,8})\s+(\d+(?:\.\d+)?)%\s*$/i.exec(s));
  if (stops.length < 2 || stops.some((s) => !s)) return null;
  return {
    angle: Number(match[1]),
    colors: stops.map((s) => expandHex(s![1])),
    positions: stops.map((s) => Number(s![2]) / 100),
  };
}

/** "#abc" → "#AABBCC"; longer hex values pass through uppercased. */
export function expandHex(hex: string): string {
  const h = hex.toUpperCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

/** "#RRGGBB" (or "#RGB") + alpha 0–1 → "#RRGGBBAA". */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${expandHex(hex).slice(0, 7)}${a}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}
