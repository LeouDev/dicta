/**
 * Font library for quote cards. Every face is from Google Fonts under the SIL
 * Open Font License 1.1, which permits bundling in commercial apps.
 *
 * Only the weights listed here ship in the binary; import per-weight subpaths
 * so Metro doesn't pull in every file in a family.
 */
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Archivo_800ExtraBold_Italic } from '@expo-google-fonts/archivo/800ExtraBold_Italic';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { Caveat_400Regular } from '@expo-google-fonts/caveat/400Regular';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat/600SemiBold';
import { CaveatBrush_400Regular } from '@expo-google-fonts/caveat-brush/400Regular';
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular';
import { CourierPrime_400Regular_Italic } from '@expo-google-fonts/courier-prime/400Regular_Italic';
import { CourierPrime_700Bold } from '@expo-google-fonts/courier-prime/700Bold';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display/400Regular';
import { DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display/400Regular_Italic';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_400Regular_Italic } from '@expo-google-fonts/instrument-sans/400Regular_Italic';
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand/400Regular';
import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display/400Regular';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display/400Regular_Italic';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { PlayfairDisplay_900Black } from '@expo-google-fonts/playfair-display/900Black';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono/400Regular';
import { SourceSerif4_300Light } from '@expo-google-fonts/source-serif-4/300Light';
import { SourceSerif4_400Regular_Italic } from '@expo-google-fonts/source-serif-4/400Regular_Italic';
import { SourceSerif4_500Medium } from '@expo-google-fonts/source-serif-4/500Medium';
import { SourceSerif4_700Bold } from '@expo-google-fonts/source-serif-4/700Bold';
import { VT323_400Regular } from '@expo-google-fonts/vt323/400Regular';

/** Passed to `useFonts` and to Skia; keys become the registered family names. */
export const fontAssets = {
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_800ExtraBold_Italic,
  Archivo_900Black,
  Caveat_400Regular,
  Caveat_600SemiBold,
  CaveatBrush_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CourierPrime_400Regular,
  CourierPrime_400Regular_Italic,
  CourierPrime_700Bold,
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
  InstrumentSans_400Regular,
  InstrumentSans_400Regular_Italic,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  PatrickHand_400Regular,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_900Black,
  ShareTechMono_400Regular,
  SourceSerif4_300Light,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_500Medium,
  SourceSerif4_700Bold,
  VT323_400Regular,
};

export type RegisteredFace = keyof typeof fontAssets;

export type FontCategory = 'serif' | 'sans' | 'mono' | 'script';

export type FontWeight = 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface FontOption {
  label: string;
  category: FontCategory;
  /** Weight → registered face. RN custom fonts need one family per weight. */
  faces: Partial<Record<FontWeight, RegisteredFace>>;
  italics?: Partial<Record<FontWeight, RegisteredFace>>;
  defaultWeight: FontWeight;
  /** Space between words, in em. Monospace faces use a wider, fixed gap. */
  wordGap: number;
}

export const FONT_LIBRARY = {
  editorial: {
    label: 'Editorial',
    category: 'serif',
    faces: { 300: 'SourceSerif4_300Light', 500: 'SourceSerif4_500Medium', 700: 'SourceSerif4_700Bold' },
    italics: { 400: 'SourceSerif4_400Regular_Italic' },
    defaultWeight: 700,
    wordGap: 0.25,
  },
  display: {
    label: 'Display',
    category: 'serif',
    faces: { 400: 'DMSerifDisplay_400Regular' },
    italics: { 400: 'DMSerifDisplay_400Regular_Italic' },
    defaultWeight: 400,
    wordGap: 0.25,
  },
  classic: {
    label: 'Classic',
    category: 'serif',
    faces: { 400: 'PlayfairDisplay_400Regular', 700: 'PlayfairDisplay_700Bold', 900: 'PlayfairDisplay_900Black' },
    italics: { 400: 'PlayfairDisplay_400Regular_Italic' },
    defaultWeight: 700,
    wordGap: 0.25,
  },
  elegant: {
    label: 'Elegant',
    category: 'serif',
    faces: { 500: 'CormorantGaramond_500Medium', 600: 'CormorantGaramond_600SemiBold' },
    italics: { 500: 'CormorantGaramond_500Medium_Italic' },
    defaultWeight: 500,
    wordGap: 0.25,
  },
  modern: {
    label: 'Modern',
    category: 'sans',
    faces: {
      400: 'InstrumentSans_400Regular',
      500: 'InstrumentSans_500Medium',
      600: 'InstrumentSans_600SemiBold',
      700: 'InstrumentSans_700Bold',
    },
    italics: { 400: 'InstrumentSans_400Regular_Italic' },
    defaultWeight: 500,
    wordGap: 0.25,
  },
  bold: {
    label: 'Bold',
    category: 'sans',
    faces: { 700: 'Archivo_700Bold', 800: 'Archivo_800ExtraBold', 900: 'Archivo_900Black' },
    italics: { 800: 'Archivo_800ExtraBold_Italic' },
    defaultWeight: 800,
    wordGap: 0.25,
  },
  rounded: {
    label: 'Rounded',
    category: 'sans',
    faces: { 400: 'Nunito_400Regular', 700: 'Nunito_700Bold', 800: 'Nunito_800ExtraBold' },
    defaultWeight: 800,
    wordGap: 0.25,
  },
  typewriter: {
    label: 'Typewriter',
    category: 'mono',
    faces: { 400: 'CourierPrime_400Regular', 700: 'CourierPrime_700Bold' },
    italics: { 400: 'CourierPrime_400Regular_Italic' },
    defaultWeight: 400,
    wordGap: 0.6,
  },
  lcd: {
    label: 'Pager',
    category: 'mono',
    faces: { 400: 'ShareTechMono_400Regular' },
    defaultWeight: 400,
    wordGap: 0.5,
  },
  pixel: {
    label: 'Pixel',
    category: 'mono',
    faces: { 400: 'VT323_400Regular' },
    defaultWeight: 400,
    wordGap: 0.5,
  },
  hand: {
    label: 'Handwritten',
    category: 'script',
    faces: { 400: 'Caveat_400Regular', 600: 'Caveat_600SemiBold' },
    defaultWeight: 600,
    wordGap: 0.25,
  },
  print: {
    label: 'Print',
    category: 'script',
    faces: { 400: 'PatrickHand_400Regular' },
    defaultWeight: 400,
    wordGap: 0.25,
  },
  brush: {
    label: 'Marker',
    category: 'script',
    faces: { 400: 'CaveatBrush_400Regular' },
    defaultWeight: 400,
    wordGap: 0.25,
  },
} as const satisfies Record<string, FontOption>;

export type FontKey = keyof typeof FONT_LIBRARY;

export const FONT_KEYS = Object.keys(FONT_LIBRARY) as FontKey[];

export function isFontKey(value: unknown): value is FontKey {
  return typeof value === 'string' && Object.hasOwn(FONT_LIBRARY, value);
}

const weightsOf = (faces: Partial<Record<FontWeight, RegisteredFace>> | undefined) =>
  (Object.keys(faces ?? {}).map(Number) as FontWeight[]).sort((a, b) => a - b);

export const availableWeights = (key: FontKey): FontWeight[] => weightsOf(FONT_LIBRARY[key].faces);

export const hasItalic = (key: FontKey): boolean => weightsOf((FONT_LIBRARY[key] as FontOption).italics).length > 0;

const closest = (weights: FontWeight[], weight: number) =>
  weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));

/** Registered face for a font at the closest available weight (italic when the family has one). */
export function resolveFace(key: FontKey, weight: number, italic = false): RegisteredFace {
  const font: FontOption = FONT_LIBRARY[key];
  const set = italic && font.italics ? font.italics : font.faces;
  return set[closest(weightsOf(set), weight)]!;
}

/** Faces the card chrome uses (header, captions, watermark), independent of the design's font. */
export const UI_FACES = {
  name: 'InstrumentSans_700Bold',
  handle: 'InstrumentSans_400Regular',
  caption: 'InstrumentSans_600SemiBold',
  note: 'InstrumentSans_400Regular_Italic',
  monogram: 'DMSerifDisplay_400Regular',
  wordmark: 'CormorantGaramond_600SemiBold',
  script: 'Caveat_600SemiBold',
  serifItalic: 'SourceSerif4_400Regular_Italic',
} as const satisfies Record<string, RegisteredFace>;
