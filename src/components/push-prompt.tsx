import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';
import { enablePush, pushPermission, type PushPermission } from '@/services/push';

/**
 * Offers, on Activity, to send these as notifications too. iOS only lets an
 * app ask once, so it asks here, where the reason is on screen, rather than at
 * launch. Hidden once iOS has an answer.
 */
export function PushPrompt() {
  const theme = useTheme();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    pushPermission()
      .then(setPermission)
      .catch(() => {});
  }, []);

  if (permission !== 'undetermined') return null;

  const turnOn = () => {
    setAsking(true);
    enablePush()
      .then(setPermission)
      .catch((e) => Alert.alert('Couldn’t turn on notifications', friendlyError(e)))
      .finally(() => setAsking(false));
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text variant="headline">Don’t miss a reply</Text>
      <Text variant="subhead" color="textSecondary">
        Get a notification when someone follows you, likes your quotes, comments or replies.
      </Text>
      <Button label="Turn on notifications" size="md" loading={asking} onPress={turnOn} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  button: { marginTop: spacing.sm },
});
