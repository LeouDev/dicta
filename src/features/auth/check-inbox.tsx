import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

interface CheckInboxProps {
  email: string;
  message: string;
  onDone: () => void;
  doneLabel: string;
}

export function CheckInbox({ email, message, onDone, doneLabel }: CheckInboxProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
        <Icon name="mail" size={28} color={theme.accent} />
      </View>
      <Text variant="display" align="center">
        Check your inbox
      </Text>
      <Text variant="callout" color="textSecondary" align="center" style={styles.body}>
        {message} <Text variant="callout" style={{ fontWeight: '600' }}>{email}</Text>
      </Text>
      <View style={styles.actions}>
        <Button label="Open Mail" icon="mail" onPress={() => Linking.openURL('message://')} />
        <Button label={doneLabel} variant="ghost" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  badge: { width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  body: { maxWidth: 320 },
  actions: { alignSelf: 'stretch', gap: spacing.xs, marginTop: spacing.xl },
});
