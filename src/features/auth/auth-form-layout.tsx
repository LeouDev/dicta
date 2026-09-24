import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';

interface AuthFormLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthFormLayout({ title, subtitle, children, footer }: AuthFormLayoutProps) {
  return (
    <Screen scroll>
      <BackButton />
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle && (
          <Text variant="callout" color="textSecondary">
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.body}>{children}</View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
  body: { gap: spacing.md },
  footer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingVertical: spacing.lg },
});
