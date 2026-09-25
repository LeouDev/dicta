import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FadeUp, STAGGER_MS } from '@/components/fade-up';
import { BackButton } from '@/components/ui/back-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';

interface AuthFormLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * When set, the back button, title and subtitle fade up in turn from this time
   * (ms); the screen staggers its own fields and footer after them (FadeUp).
   */
  entrance?: number;
}

export function AuthFormLayout({ title, subtitle, children, footer, entrance }: AuthFormLayoutProps) {
  const enter = (index: number, node: ReactNode) =>
    entrance === undefined ? node : <FadeUp delay={entrance + index * STAGGER_MS}>{node}</FadeUp>;

  return (
    <Screen scroll>
      {enter(0, <BackButton />)}
      <View style={styles.header}>
        {enter(
          1,
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>,
        )}
        {subtitle &&
          enter(
            2,
            <Text variant="callout" color="textSecondary">
              {subtitle}
            </Text>,
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
