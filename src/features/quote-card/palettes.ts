import type { CardBackground } from './types';

/** Curated color choices so people rarely need hex values. */

export interface NamedColor {
  name: string;
  value: string;
}

export const TEXT_COLORS: NamedColor[] = [
  { name: 'Burgundy', value: '#8A0F10' },
  { name: 'Ink', value: '#1A1714' },
  { name: 'Black', value: '#0B0B0C' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Cream', value: '#F4EEE3' },
  { name: 'Gray', value: '#6B645C' },
  { name: 'Navy', value: '#1E2A4A' },
  { name: 'Forest', value: '#2F4A3A' },
  { name: 'Terracotta', value: '#B5523B' },
];

export const BACKGROUND_COLORS: NamedColor[] = [
  { name: 'Paper', value: '#FAF8F3' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Beige', value: '#E9DFCF' },
  { name: 'Soft gray', value: '#E7E5E0' },
  { name: 'Charcoal', value: '#2A2A2C' },
  { name: 'Black', value: '#0E0E10' },
  { name: 'Navy', value: '#1C2541' },
  { name: 'Burgundy', value: '#6E1423' },
  { name: 'Sage', value: '#DDE5D6' },
  { name: 'Blush', value: '#F6E1DC' },
  { name: 'Lavender', value: '#E6E1F4' },
  { name: 'Sky', value: '#DCEAF4' },
  { name: 'Butter', value: '#F7EDC9' },
];

export interface Palette {
  name: string;
  background: string;
  text: string;
  meta: string;
}

export const PALETTES: Palette[] = [
  { name: 'Editorial', background: '#FAF8F3', text: '#8A0F10', meta: '#141414' },
  { name: 'Ink', background: '#FFFFFF', text: '#111111', meta: '#111111' },
  { name: 'Midnight', background: '#0E0E10', text: '#F2EEE6', meta: '#BDB6AC' },
  { name: 'Navy', background: '#1C2541', text: '#F6F1E7', meta: '#C9C3B6' },
  { name: 'Wine', background: '#6E1423', text: '#F6E7D8', meta: '#E8CFC0' },
  { name: 'Sage', background: '#DDE5D6', text: '#2F4A3A', meta: '#2F4A3A' },
  { name: 'Blush', background: '#F6E1DC', text: '#7A2E3A', meta: '#3A2A2A' },
  { name: 'Sand', background: '#E9DFCF', text: '#3B2F25', meta: '#3B2F25' },
];

export interface GradientPreset {
  name: string;
  colors: string[];
}

export const GRADIENTS: GradientPreset[] = [
  { name: 'Dawn', colors: ['#FBD3C1', '#E4C8F2'] },
  { name: 'Sea', colors: ['#CFE8F1', '#E8E3F8'] },
  { name: 'Citrus', colors: ['#FDF0C4', '#F8C6B4'] },
  { name: 'Mint', colors: ['#D5F1E2', '#F4F0D0'] },
  { name: 'Rose', colors: ['#F9D9E0', '#F6ECD9'] },
  { name: 'Dusk', colors: ['#2B1E3F', '#8A4461'] },
  { name: 'Deep', colors: ['#0F2027', '#2C5364'] },
  { name: 'Ember', colors: ['#3A0F14', '#A1361E'] },
];

/** WCAG relative luminance of a #RRGGBB(AA) color. */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Approximate luminance behind the text: gradients average, photos sit under a dark scrim. */
export function backgroundLuminance(bg: CardBackground): number {
  if (bg.type === 'solid') return luminance(bg.color);
  if (bg.type === 'gradient') return bg.colors.reduce((sum, c) => sum + luminance(c), 0) / bg.colors.length;
  return 0.04;
}

/** Ink or white, whichever reads better on the background. */
export function readableTextFor(bg: CardBackground): string {
  return backgroundLuminance(bg) < 0.22 ? '#FFFFFF' : '#1A1714';
}

/** WCAG contrast between a text color and a background (3 is the large-text minimum). */
export function contrastWith(text: string, bg: CardBackground): number {
  const a = luminance(text);
  const b = backgroundLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
