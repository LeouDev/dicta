import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { useReport } from '@/hooks/use-safety';
import { useTheme } from '@/hooks/use-theme';
import { REPORT_REASONS, type ReportReason } from '@/services/safety';

export interface ReportTarget {
  kind: 'post' | 'user' | 'comment';
  id: string;
  /** Shown in the title, e.g. "@maravell" or "this quote". */
  label: string;
}

export const openReport = (target: ReportTarget) => router.push({ pathname: '/report', params: { ...target } });
const closeReport = () => router.back();

/** The /report modal screen. */
export function ReportScreen() {
  const target = useLocalSearchParams<Record<keyof ReportTarget, string>>() as ReportTarget;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const report = useReport();

  const submit = () => {
    if (!reason) return;
    report.mutate(
      {
        reason,
        details,
        postId: target.kind === 'post' ? target.id : undefined,
        userId: target.kind === 'user' ? target.id : undefined,
        commentId: target.kind === 'comment' ? target.id : undefined,
      },
      { onSuccess: closeReport },
    );
  };

  return (
    <View style={[styles.sheet, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={closeReport} accessibilityRole="button" hitSlop={12}>
          <Text variant="body" color="textSecondary">
            Cancel
          </Text>
        </Pressable>
        <Text variant="headline">Report</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <Text variant="title">Why are you reporting {target.label}?</Text>
        <Text variant="callout" color="textSecondary">
          Reports are private. The person won’t know who reported them.
        </Text>
        <View style={[styles.list, { backgroundColor: theme.surface }]} accessibilityRole="radiogroup">
          {REPORT_REASONS.map((r, i) => {
            const selected = r.value === reason;
            return (
              <Pressable
                key={r.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setReason(r.value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.hairline,
                  },
                ]}>
                <Text variant="body">{r.label}</Text>
                {selected && <Icon name="check" size={18} color={theme.accent} weight="semibold" />}
              </Pressable>
            );
          })}
        </View>
        <TextField
          label="Anything else? (optional)"
          value={details}
          onChangeText={setDetails}
          multiline
          maxLength={1000}
          placeholder="Add details that help us understand"
          style={styles.details}
        />
        <Button label="Send report" variant="accent" onPress={submit} disabled={!reason} loading={report.isPending} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerSpacer: { width: 52 },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  list: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: hitTarget + 4,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  details: { minHeight: 72, textAlignVertical: 'top' },
});
