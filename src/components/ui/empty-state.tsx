import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/tokens';

import { Button } from './button';
import { Text } from './text';

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered editorial message for empty, error and "coming soon" states. */
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="title" align="center">
        {title}
      </Text>
      {message && (
        <Text variant="callout" color="textSecondary" align="center" style={styles.message}>
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="md" style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  message: { maxWidth: 300 },
  action: { marginTop: spacing.md },
});
