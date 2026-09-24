import * as Haptics from 'expo-haptics';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT = { lg: 52, md: 44, sm: 36 } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: 'transparent' },
    accent: { bg: theme.accent, fg: theme.onAccent, border: 'transparent' },
    secondary: { bg: 'transparent', fg: theme.text, border: theme.hairline },
    ghost: { bg: 'transparent', fg: theme.textSecondary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={() => {
        if (variant === 'primary' || variant === 'accent') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={inactive}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={size === 'sm' ? 15 : 18} color={palette.fg} weight="semibold" />}
          <Text variant={size === 'sm' ? 'subhead' : 'bodyStrong'} style={{ color: palette.fg }}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
