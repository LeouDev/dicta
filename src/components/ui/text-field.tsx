import { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

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
}

export function TextField({ label, error, hint, prefix, trailing, ref, onFocus, onBlur, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.textTertiary : 'transparent';

  return (
    <View style={styles.wrap}>
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
    </View>
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
