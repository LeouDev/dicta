import { Skia } from '@shopify/react-native-skia';

import type { TextureKey } from './types';

/**
 * Procedural textures in one runtime shader: no image assets, sharp at any
 * export size. Positions are divided by `unit` (max(0.45, 2 × scale)), so a
 * texture keeps its character from a thumbnail to a 1080px export.
 *
 * Output is composited over the card with the blend mode from `textureBlend`:
 * multiply for paper-like looks, screen for grain on dark cards, overlay for
 * heavy black-and-white grain.
 */
const SKSL = `
uniform float kind;
uniform float intensity;
uniform float unit;
uniform float2 size;
uniform float seed;
uniform float dark;
uniform float pitch;
uniform float phase;

float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + float2(17.0, 9.0);
    amp *= 0.5;
  }
  return v;
}

half4 gray(float v) { return half4(half3(half(v)), 1.0); }

// Speckle amount s (0..1): darkening multiply on light cards, lightening screen on dark ones.
half4 speckle(float s) { return dark > 0.5 ? gray(s) : gray(1.0 - s); }

half4 main(float2 xy) {
  float2 p = xy / unit + seed;
  float2 uv = xy / size;
  float k = intensity;

  if (kind < 1.5) {
    // Paper: sparse cloudy patches, occasional fibers, fine tooth.
    float mottle = smoothstep(0.5, 0.85, fbm(p * 0.004));
    float fibers = smoothstep(0.62, 0.9, fbm(p * 0.03 + 5.0));
    float tooth = hash(floor(p * 1.2));
    float v = 1.0 - k * (0.05 * mottle + 0.04 * fibers + 0.05 * tooth);
    return half4(half(v), half(v * 0.997), half(v * 0.99), 1.0);
  }
  if (kind < 2.5) {
    // Grain: per-unit film grain.
    return speckle(k * 0.22 * hash(floor(p * 1.1)));
  }
  if (kind < 3.5) {
    // Heavy grain (overlay): coarse black-and-white grain that both lightens and darkens.
    float g = 0.7 * hash(floor(p * 0.7)) + 0.3 * vnoise(p * 0.35);
    return gray(0.5 + k * 0.55 * (g - 0.5));
  }
  if (kind < 4.5) {
    // Canvas: woven threads plus a little tooth.
    float wx = 0.5 + 0.5 * sin(p.x * 0.62 + vnoise(p * 0.08) * 2.0);
    float wy = 0.5 + 0.5 * sin(p.y * 0.62 + vnoise(p * 0.08 + 7.0) * 2.0);
    float tooth = hash(floor(p * 1.2));
    float v = 1.0 - k * (0.12 * wx * wy + 0.05 * fbm(p * 0.03) + 0.05 * tooth);
    return half4(half(v), half(v), half(v * 0.99), 1.0);
  }
  if (kind < 5.5) {
    // Film: warm vignette and grain; on dark cards only the grain, lightening.
    float g = hash(floor(p * 1.1));
    if (dark > 0.5) return gray(k * 0.2 * g);
    float vig = smoothstep(0.32, 0.9, distance(uv, float2(0.5, 0.5)));
    float v = (1.0 - k * 0.55 * vig) * (1.0 - k * 0.16 * (g - 0.5));
    return half4(half(v), half(v * 0.985), half(v * 0.955), 1.0);
  }
  if (kind < 6.5) {
    // Lined: ruled lines on the text baselines (pitch = line height, phase = first baseline).
    float d = mod(xy.y - phase + pitch * 0.5, pitch) - pitch * 0.5;
    float line = 1.0 - smoothstep(0.0, max(1.0, unit * 1.2), abs(d - unit * 1.5));
    float tooth = hash(floor(p * 1.2));
    float v = 1.0 - k * (0.32 * line + 0.03 * tooth);
    return half4(half(v - k * 0.05 * line), half(v - k * 0.02 * line), half(v), 1.0);
  }
  if (kind < 7.5) {
    // Book page: faint rows of word-shaped marks, like text showing through the page.
    float rows = p.y / 19.0;
    float row = floor(rows);
    float fy = fract(rows);
    float band = smoothstep(0.34, 0.42, fy) * (1.0 - smoothstep(0.6, 0.68, fy));
    float wx = p.x / 7.0 + hash(float2(row, 3.0)) * 10.0;
    float cell = floor(wx);
    float word = step(fract(wx), 0.35 + 0.55 * hash(float2(cell, row)));
    float margin = smoothstep(0.05, 0.1, uv.x) * (1.0 - smoothstep(0.9, 0.95, uv.x)) * smoothstep(0.04, 0.08, uv.y) * (1.0 - smoothstep(0.92, 0.96, uv.y));
    float ink = band * word * margin * (0.6 + 0.4 * hash(floor(p * 0.8)));
    float tooth = hash(floor(p * 1.2));
    float v = 1.0 - k * (0.13 * ink + 0.035 * tooth + 0.05 * smoothstep(0.55, 1.0, uv.x));
    return gray(v);
  }
  if (kind < 8.5) {
    // Concrete: mottled cement, small pits, and light falling from the left.
    float n = fbm(p * 0.018);
    float fine = fbm(p * 0.2);
    float pits = step(0.992, hash(floor(p * 0.55)));
    float v = 1.0 - k * (0.2 * n + 0.1 * fine + 0.35 * pits + 0.22 * uv.x * uv.x);
    return half4(half(v), half(v * 0.99), half(v * 0.97), 1.0);
  }
  if (kind < 9.5) {
    // Mottle: soft blotches and fine speckle, like hand-pulled ink.
    float m = smoothstep(0.35, 0.78, fbm(p * 0.009));
    float m2 = fbm(p * 0.04 + 11.0);
    float v = 1.0 - k * (0.34 * m + 0.14 * m2 + 0.05 * hash(floor(p * 1.1)));
    return gray(v);
  }
  // Scanlines: horizontal display lines.
  float s = 0.5 + 0.5 * sin(xy.y / (unit * 1.6) * 3.14159);
  return gray(1.0 - k * 0.5 * s * s);
}
`;

export const textureEffect = Skia.RuntimeEffect.Make(SKSL);

if (!textureEffect && __DEV__) console.warn('Texture shader failed to compile');

export const TEXTURE_KIND: Record<Exclude<TextureKey, 'none'>, number> = {
  paper: 1,
  grain: 2,
  heavygrain: 3,
  canvas: 4,
  film: 5,
  lined: 6,
  bookpage: 7,
  concrete: 8,
  mottle: 9,
  scanlines: 10,
};

/** Blend mode and shader flag for a texture on a light or dark card. */
export function textureBlend(texture: Exclude<TextureKey, 'none'>, dark: boolean) {
  if (texture === 'heavygrain') return { blendMode: 'overlay' as const, dark: 0 };
  const adaptive = texture === 'grain' || texture === 'film';
  return { blendMode: adaptive && dark ? ('screen' as const) : ('multiply' as const), dark: adaptive && dark ? 1 : 0 };
}

export const TEXTURE_LABELS: Record<TextureKey, string> = {
  none: 'None',
  paper: 'Paper',
  grain: 'Grain',
  heavygrain: 'Heavy',
  canvas: 'Canvas',
  film: 'Film',
  lined: 'Lined',
  bookpage: 'Book',
  concrete: 'Concrete',
  mottle: 'Mottle',
  scanlines: 'Scan',
};
