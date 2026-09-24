import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/tokens';

import { Text } from './text';

interface ScreenHeaderProps {
  title?: string;
  /** Replaces the title (e.g. the wordmark on Home). */
  left?: ReactNode;
  right?: ReactNode;
}

/** Large editorial title row used at the top of each tab. */
export function ScreenHeader({ title, left, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      {left ?? (
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      )}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingTop: spacing.xs,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
