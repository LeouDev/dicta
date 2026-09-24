/**
 * Font library. Every face is from Google Fonts under the SIL Open Font
 * License 1.1, which permits bundling in commercial apps.
 *
 * Only the weights listed here ship in the binary; import per-weight subpaths
 * so Metro doesn't pull in every file in a family.
 */
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black/400Regular';
import { Caveat_400Regular } from '@expo-google-fonts/caveat/400Regular';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat/600SemiBold';
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond/700Bold';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular';
import { CourierPrime_700Bold } from '@expo-google-fonts/courier-prime/700Bold';
import { DMSans_300Light } from '@expo-google-fonts/dm-sans/300Light';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display/400Regular_Italic';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { LibreBaskerville_400Regular } from '@expo-google-fonts/libre-baskerville/400Regular';
import { LibreBaskerville_700Bold } from '@expo-google-fonts/libre-baskerville/700Bold';

/** Passed to `useFonts`; keys become the registered family names. */
export const fontAssets = {
  ArchivoBlack_400Regular,
  Caveat_400Regular,
  Caveat_600SemiBold,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
  CourierPrime_400Regular,
  CourierPrime_700Bold,
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  LibreBaskerville_400Regular,
  LibreBaskerville_700Bold,
};

type RegisteredFace = keyof typeof fontAssets;

export type FontCategory = 'serif' | 'sans' | 'typewriter' | 'handwritten';

export type FontWeight = 300 | 400 | 500 | 600 | 700 | 800;

export interface FontOption {
  label: string;
  category: FontCategory;
  /** Weight → registered face. RN custom fonts need one family per weight. */
  faces: Partial<Record<FontWeight, RegisteredFace>>;
  defaultWeight: FontWeight;
}

export const FONT_LIBRARY = {
  editorial: {
    label: 'Editorial',
    category: 'serif',
    faces: { 400: 'DMSerifDisplay_400Regular' },
    defaultWeight: 400,
  },
  elegant: {
    label: 'Elegant',
    category: 'serif',
    faces: {
      500: 'CormorantGaramond_500Medium',
      600: 'CormorantGaramond_600SemiBold',
      700: 'CormorantGaramond_700Bold',
    },
    defaultWeight: 600,
  },
  classic: {
    label: 'Classic',
    category: 'serif',
    faces: { 400: 'LibreBaskerville_400Regular', 700: 'LibreBaskerville_700Bold' },
    defaultWeight: 400,
  },
  modern: {
    label: 'Modern',
    category: 'sans',
    faces: { 400: 'Inter_400Regular', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' },
    defaultWeight: 600,
  },
  minimal: {
    label: 'Minimal',
    category: 'sans',
    faces: { 300: 'DMSans_300Light', 400: 'DMSans_400Regular', 500: 'DMSans_500Medium' },
    defaultWeight: 400,
  },
  bold: {
    label: 'Bold',
    category: 'sans',
    faces: { 800: 'ArchivoBlack_400Regular' },
    defaultWeight: 800,
  },
  typewriter: {
    label: 'Typewriter',
    category: 'typewriter',
    faces: { 400: 'CourierPrime_400Regular', 700: 'CourierPrime_700Bold' },
    defaultWeight: 400,
  },
  handwritten: {
    label: 'Handwritten',
    category: 'handwritten',
    faces: { 400: 'Caveat_400Regular', 600: 'Caveat_600SemiBold' },
    defaultWeight: 400,
  },
} as const satisfies Record<string, FontOption>;

export type FontId = keyof typeof FONT_LIBRARY;

export const FONT_IDS = Object.keys(FONT_LIBRARY) as FontId[];

export function isFontId(value: string): value is FontId {
  return value in FONT_LIBRARY;
}

export function availableWeights(id: FontId): FontWeight[] {
  return (Object.keys(FONT_LIBRARY[id].faces).map(Number) as FontWeight[]).sort((a, b) => a - b);
}

/** Registered face for a font at the closest available weight. */
export function resolveFontFace(id: FontId, weight: number): RegisteredFace {
  const font: FontOption = FONT_LIBRARY[id];
  const closest = availableWeights(id).reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  );
  return font.faces[closest]!;
}
