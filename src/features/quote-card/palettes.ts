import { expandHex } from './geometry';
import type { CardBackground, QuoteDesign } from './types';

/** Curated color choices so people rarely need hex values. */

export interface NamedColor {
  name: string;
  value: string;
}

export const TEXT_COLORS: NamedColor[] = [
  { name: 'Burgundy', value: '#9B1B1E' },
  { name: 'Ink', value: '#141414' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Cream', value: '#EFE8DA' },
  { name: 'Navy', value: '#1D2B4E' },
  { name: 'Gray', value: '#6B645C' },
  { name: 'Forest', value: '#2F4A3A' },
  { name: 'Terracotta', value: '#B5523B' },
  { name: 'Signal', value: '#EE3A22' },
];

export const BACKGROUND_COLORS: NamedColor[] = [
  { name: 'Paper', value: '#F3EEE5' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Notebook', value: '#F6F0E1' },
  { name: 'Kraft', value: '#ECE2CC' },
  { name: 'Charcoal', value: '#2A2A2C' },
  { name: 'Midnight', value: '#121212' },
  { name: 'Navy', value: '#1C2A4A' },
  { name: 'Olive', value: '#57561F' },
  { name: 'Wine', value: '#7A171B' },
  { name: 'Sage', value: '#DDE5D6' },
  { name: 'Blush', value: '#F6E1DC' },
  { name: 'Sky', value: '#DCEAF4' },
];

export interface Palette {
  name: string;
  background: string;
  text: string;
}

export const PALETTES: Palette[] = [
  { name: 'Editorial', background: '#F3EEE5', text: '#9B1B1E' },
  { name: 'Ink', background: '#FFFFFF', text: '#141414' },
  { name: 'Midnight', background: '#121212', text: '#EFE8DA' },
  { name: 'Navy', background: '#1C2A4A', text: '#F3EEE5' },
  { name: 'Wine', background: '#7A171B', text: '#FFFFFF' },
  { name: 'Olive', background: '#57561F', text: '#F6F2E8' },
  { name: 'Notebook', background: '#F6F0E1', text: '#1D2B4E' },
  { name: 'Sage', background: '#DDE5D6', text: '#2F4A3A' },
];

export interface GradientPreset {
  name: string;
  color: string;
  color2: string;
}

export const GRADIENTS: GradientPreset[] = [
  { name: 'Peach', color: '#F2C7B3', color2: '#CFCDEB' },
  { name: 'Sky', color: '#6F6F6F', color2: '#ECECEC' },
  { name: 'Smoke', color: '#3B4249', color2: '#050607' },
  { name: 'Wall', color: '#DCCBA7', color2: '#7F7262' },
  { name: 'Page', color: '#F1ECE2', color2: '#D9D1C2' },
  { name: 'Ember', color: '#7A171B', color2: '#3F0A0D' },
  { name: 'Night', color: '#3A3A3A', color2: '#141414' },
  { name: 'Sea', color: '#CFE8F1', color2: '#E8E3F8' },
];

/** WCAG relative luminance of a hex color. */
export function luminance(hex: string): number {
  const h = expandHex(hex);
  const channel = (i: number) => {
    const c = parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Luminance behind the text: gradients and splits average; photos are judged by their text color. */
export function backgroundLuminance(bg: CardBackground, textColor: string): number {
  if (bg.type === 'solid') return luminance(bg.color);
  if (bg.type === 'image') return luminance(textColor) > 0.5 ? 0.04 : 0.8;
  return (luminance(bg.color) + luminance(bg.color2)) / 2;
}

/** Drives header colors, texture blending and the watermark (Templates.md: luminance < 0.3). */
export const isDarkDesign = (design: Pick<QuoteDesign, 'background' | 'textColor'>) =>
  backgroundLuminance(design.background, design.textColor) < 0.3;

/** Ink or white, whichever reads better on the background. */
export function readableTextFor(bg: CardBackground): string {
  return bg.type !== 'image' && backgroundLuminance(bg, '#141414') >= 0.22 ? '#141414' : '#FFFFFF';
}

/** WCAG contrast between a text color and a background (3 is the large-text minimum). */
export function contrastWith(text: string, bg: CardBackground): number {
  if (bg.type === 'image') return 21; // the overlay takes care of photos
  const a = luminance(text);
  const b = backgroundLuminance(bg, text);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
