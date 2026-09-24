/**
 * Dicta design tokens. Every color, size and duration used by app chrome
 * comes from here. Quote card designs carry their own colors (see
 * `QuoteDesign`) and are intentionally independent of the app theme.
 */

const palette = {
  paper: '#F7F3EC',
  paperDeep: '#EFE8DC',
  white: '#FFFFFF',
  ink: '#1A1714',
  ink2: '#5F5850',
  ink3: '#9C948A',
  burgundy: '#8E1B1B',
  burgundySoft: '#F3E4E1',
  navy: '#1E2A4A',

  night: '#121110',
  nightRaised: '#1C1A18',
  nightHigh: '#262320',
  moon: '#F4EFE8',
  moon2: '#B3ABA1',
  moon3: '#7A736A',
  rose: '#E07A72',
  roseSoft: '#3A2322',

  danger: '#C2362F',
  success: '#2F7D4F',
} as const;

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  primary: string;
  onPrimary: string;
  hairline: string;
  overlay: string;
  danger: string;
  success: string;
  skeleton: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: palette.paper,
    surface: palette.white,
    surfaceRaised: palette.white,
    text: palette.ink,
    textSecondary: palette.ink2,
    textTertiary: palette.ink3,
    accent: palette.burgundy,
    accentSoft: palette.burgundySoft,
    onAccent: palette.white,
    primary: palette.ink,
    onPrimary: palette.paper,
    hairline: 'rgba(26, 23, 20, 0.09)',
    overlay: 'rgba(18, 17, 16, 0.4)',
    danger: palette.danger,
    success: palette.success,
    skeleton: palette.paperDeep,
  },
  dark: {
    background: palette.night,
    surface: palette.nightRaised,
    surfaceRaised: palette.nightHigh,
    text: palette.moon,
    textSecondary: palette.moon2,
    textTertiary: palette.moon3,
    accent: palette.rose,
    accentSoft: palette.roseSoft,
    onAccent: palette.night,
    primary: palette.moon,
    onPrimary: palette.night,
    hairline: 'rgba(244, 239, 232, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    danger: '#E5625A',
    success: '#5BB57F',
    skeleton: palette.nightHigh,
  },
};

/** 8pt grid (with a 4pt half-step for tight spots). */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Font family names as registered by `useFonts` in the root layout. */
export const fontFamily = {
  display: 'DMSerifDisplay_400Regular',
  displayItalic: 'DMSerifDisplay_400Regular_Italic',
  wordmark: 'CormorantGaramond_600SemiBold',
  /** `undefined` = San Francisco, the native iOS UI font. */
  ui: undefined,
} as const;

export const typography = {
  hero: { fontFamily: fontFamily.display, fontSize: 44, lineHeight: 48, letterSpacing: -0.5 },
  display: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.3 },
  title: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  subhead: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.2 },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const shadows = {
  none: {},
  soft: {
    shadowColor: '#1A1714',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  card: {
    shadowColor: '#1A1714',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  lifted: {
    shadowColor: '#1A1714',
    shadowOpacity: 0.16,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
  },
} as const;

export const animation = {
  duration: { fast: 150, base: 250, slow: 400 },
  spring: { damping: 18, stiffness: 240, mass: 0.9 },
  springBouncy: { damping: 11, stiffness: 260, mass: 0.8 },
  pressScale: 0.97,
} as const;

/** Minimum touch target per Apple HIG. */
export const hitTarget = 44;
