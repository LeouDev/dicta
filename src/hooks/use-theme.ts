import { useColorScheme } from 'react-native';

import { colors, type ColorScheme, type ThemeColors } from '@/constants/tokens';

export function useSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useTheme(): ThemeColors {
  return colors[useSchemeName()];
}
