import { fontFamily } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './ui/text';

/** The DICTA wordmark, set in Cormorant Garamond caps like the app icon. */
export function Wordmark({ size = 20 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="Dicta"
      allowFontScaling={false}
      style={{ fontFamily: fontFamily.wordmark, fontSize: size, letterSpacing: size * 0.32, color: theme.accent }}>
      DICTA
    </Text>
  );
}
