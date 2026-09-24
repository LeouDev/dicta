import { StyleSheet, View } from 'react-native';

import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
import { Text } from './text';

export function FormError({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.accentSoft }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive">
      <Icon name="warning" size={18} color={theme.danger} />
      <Text variant="subhead" style={[styles.text, { color: theme.danger }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md - 4, borderRadius: radius.md },
  text: { flex: 1 },
});
