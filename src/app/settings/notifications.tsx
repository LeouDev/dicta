import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import {
  enablePush,
  fetchPushSettings,
  PUSH_KINDS,
  pushPermission,
  savePushSettings,
  type PushKind,
  type PushPermission,
  type PushSettings,
} from '@/services/push';
import { selectUserId, useAuth } from '@/store/auth';

const LABELS: Record<PushKind, string> = {
  follows: 'New followers',
  likes: 'Likes on your quotes',
  comments: 'Comments on your quotes',
  replies: 'Replies to your comments',
};

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const client = useQueryClient();
  const userId = useAuth(selectUserId);
  const permission = usePushPermission();
  const key = queryKeys.pushSettings(userId);
  const settings = useQuery({ queryKey: key, queryFn: fetchPushSettings, enabled: userId !== null });

  const save = useMutation({
    mutationFn: (next: PushSettings) => savePushSettings(userId!, next),
    onMutate: (next) => {
      const previous = client.getQueryData<PushSettings>(key);
      client.setQueryData(key, next);
      return { previous };
    },
    onError: (e, _next, context) => {
      client.setQueryData(key, context?.previous);
      Alert.alert('Couldn’t save', friendlyError(e));
    },
  });

  const turnOn = () =>
    enablePush()
      .then(permission.set)
      .catch((e) => Alert.alert('Couldn’t turn on notifications', friendlyError(e)));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      {permission.value === 'undetermined' && (
        <View style={[styles.card, styles.notice, { backgroundColor: theme.surface }]}>
          <Text variant="subhead" color="textSecondary">
            Dicta can tell you when someone follows you, likes your quotes, comments or replies.
          </Text>
          <Button label="Turn on notifications" size="md" onPress={turnOn} />
        </View>
      )}
      {permission.value === 'denied' && (
        <View style={[styles.card, styles.notice, { backgroundColor: theme.surface }]}>
          <Text variant="subhead" color="textSecondary">
            Notifications for Dicta are off in iOS Settings, so none of these will reach you.
          </Text>
          <Button label="Open Settings" variant="secondary" size="md" onPress={() => Linking.openSettings()} />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        {PUSH_KINDS.map((kind, i) => (
          <View
            key={kind}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline }]}>
            <Text variant="body" style={styles.label}>
              {LABELS[kind]}
            </Text>
            <Switch
              accessibilityLabel={LABELS[kind]}
              value={settings.data?.[kind] ?? true}
              disabled={!settings.data}
              trackColor={{ true: theme.accent }}
              onValueChange={(on) => settings.data && save.mutate({ ...settings.data, [kind]: on })}
            />
          </View>
        ))}
      </View>
      <Text variant="caption" color="textTertiary" style={styles.footer}>
        Everything still shows in Activity. You’re never notified about your own actions.
      </Text>
    </ScrollView>
  );
}

/** iOS's notification permission, checked again whenever Dicta comes back (say, from Settings). */
function usePushPermission() {
  const [value, setValue] = useState<PushPermission | null>(null);
  const set = useCallback((next: PushPermission) => setValue(next), []);
  useEffect(() => {
    const check = () =>
      pushPermission()
        .then(setValue)
        .catch(() => {});
    check();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => subscription.remove();
  }, []);
  return { value, set };
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { borderRadius: radius.md, overflow: 'hidden' },
  notice: { padding: spacing.md, gap: spacing.sm + 4 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hitTarget + 6, paddingHorizontal: spacing.md, gap: spacing.md },
  label: { flex: 1 },
  footer: { paddingHorizontal: spacing.md },
});
