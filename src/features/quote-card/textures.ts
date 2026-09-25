import { Skia } from '@shopify/react-native-skia';

import { backgroundLuminance } from './palettes';
import type { CardBackground, TextureId } from './types';

/**
 * Procedural textures, evaluated in design units so a texture looks the same
 * on a 358pt feed card and a 1080px export. One shader, five looks. Paper,
 * canvas and film multiply; grain and noise multiply on light cards and
 * screen on dark ones, so speckle shows on pure white and pure black alike.
 */
const SKSL = `
uniform float kind;
uniform float intensity;
uniform float unit;
uniform float2 size;
uniform float seed;
uniform float dark;

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

// Speckle amount s (0..1) as a darkening multiply on light cards, or a
// lightening screen on dark ones.
half4 speckle(float s) {
  if (dark > 0.5) return half4(half3(half(s)), 1.0);
  float v = 1.0 - s;
  return half4(half3(half(v)), 1.0);
}

half4 main(float2 xy) {
  float2 p = xy / unit + seed;
  float k = intensity;

  if (kind < 1.5) {
    // Paper (multiply): sparse cloudy patches, occasional fibers, fine tooth.
    // Darkening is sparse so the sheet keeps its brightness.
    float mottle = smoothstep(0.5, 0.85, fbm(p * 0.004));
    float fibers = smoothstep(0.62, 0.9, fbm(p * 0.03 + 5.0));
    float tooth = hash(floor(p * 1.2));
    float v = 1.0 - k * (0.045 * mottle + 0.035 * fibers + 0.04 * tooth);
    return half4(half(v), half(v * 0.997), half(v * 0.99), 1.0);
  }
  if (kind < 2.5) {
    // Grain: per-unit film grain.
    return speckle(k * 0.2 * hash(floor(p * 1.1)));
  }
  if (kind < 3.5) {
    // Noise: coarser, stronger speckle.
    return speckle(k * 0.3 * (0.55 * vnoise(p * 0.3) + 0.45 * hash(floor(p * 0.9))));
  }
  if (kind < 4.5) {
    // Canvas (multiply): woven threads plus a little tooth.
    float wx = 0.5 + 0.5 * sin(p.x * 0.62 + vnoise(p * 0.08) * 2.0);
    float wy = 0.5 + 0.5 * sin(p.y * 0.62 + vnoise(p * 0.08 + 7.0) * 2.0);
    float tooth = hash(floor(p * 1.2));
    float v = 1.0 - k * (0.08 * wx * wy + 0.04 * fbm(p * 0.03) + 0.04 * tooth);
    return half4(half(v), half(v), half(v * 0.99), 1.0);
  }
  // Film (multiply): vignette with warm falloff and grain.
  float2 uv = xy / size;
  float vig = smoothstep(0.32, 0.9, distance(uv, float2(0.5, 0.5)));
  float g = hash(floor(p * 1.1)) - 0.5;
  float v = (1.0 - k * 0.55 * vig) * (1.0 - k * 0.16 * g);
  return half4(half(v), half(v * 0.985), half(v * 0.955), 1.0);
}
`;

export const textureEffect = Skia.RuntimeEffect.Make(SKSL);

if (!textureEffect && __DEV__) console.warn('Texture shader failed to compile');

export const TEXTURE_KIND: Record<Exclude<TextureId, 'none'>, number> = {
  paper: 1,
  grain: 2,
  noise: 3,
  canvas: 4,
  film: 5,
};

/** Blend mode + shader flag for a texture over a given background. */
export function textureBlend(texture: Exclude<TextureId, 'none'>, background: CardBackground) {
  const dark = backgroundLuminance(background) < 0.3;
  const adaptive = texture === 'grain' || texture === 'noise';
  return { blendMode: adaptive && dark ? ('screen' as const) : ('multiply' as const), dark: adaptive && dark ? 1 : 0 };
}

export const TEXTURE_LABELS: Record<TextureId, string> = {
  none: 'None',
  paper: 'Paper',
  grain: 'Grain',
  noise: 'Noise',
  canvas: 'Canvas',
  film: 'Film',
};
