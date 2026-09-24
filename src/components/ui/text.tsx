import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography, type ThemeColors, type TypographyVariant } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

type ColorToken = 'text' | 'textSecondary' | 'textTertiary' | 'accent' | 'danger' | 'onPrimary' | 'onAccent';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const theme: ThemeColors = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'hero' || variant === 'display' ? 1.3 : 1.8}
      style={[typography[variant], { color: theme[color], textAlign: align }, style]}
      {...rest}
    />
  );
}
