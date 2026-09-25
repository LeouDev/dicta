import { fontFamily } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './ui/text';

/** The wordmark's type: Cormorant Garamond caps, tracked like the app icon. */
export const wordmarkStyle = (size: number, color: string) => ({
  fontFamily: fontFamily.wordmark,
  fontSize: size,
  letterSpacing: size * 0.32,
  color,
});

/** The DICTA wordmark, set in Cormorant Garamond caps like the app icon. */
export function Wordmark({ size = 20 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" accessibilityLabel="Dicta" allowFontScaling={false} style={wordmarkStyle(size, theme.accent)}>
      DICTA
    </Text>
  );
}
