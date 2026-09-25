import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { radius, spacing, typography } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string | null;
  prefix?: string;
  trailing?: ReactNode;
  ref?: Ref<TextInput>;
  /** Bump this number to shake the field, say on each failed submit. No shake under Reduce Motion. */
  shake?: number;
}

export function TextField({ label, error, hint, prefix, trailing, ref, shake, onFocus, onBlur, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.textTertiary : 'transparent';
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!shake || reduceMotion) return;
    const to = (x: number) => withTiming(x, { duration: 76, easing: Easing.out(Easing.quad) });
    offset.set(withSequence(to(-8), to(7), to(-5), to(3), to(0)));
  }, [shake, reduceMotion, offset]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <Animated.View style={[styles.wrap, shakeStyle]}>
      <Text variant="caption" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.field, { backgroundColor: theme.surface, borderColor }]}>
        {prefix && (
          <Text variant="body" color="textTertiary" style={styles.prefix}>
            {prefix}
          </Text>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: theme.text }, style]}
          {...rest}
        />
        {trailing}
      </View>
      {(error || hint) && (
        <Text
          variant="caption"
          color={error ? 'danger' : 'textTertiary'}
          style={styles.message}
          accessibilityLiveRegion="polite">
          {error || hint}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  label: { marginLeft: spacing.xs },
  field: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: { marginRight: 1 },
  input: { flex: 1, ...typography.body, lineHeight: undefined, paddingVertical: spacing.md - 2 },
  message: { marginLeft: spacing.xs },
});
