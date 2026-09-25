import { KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/back-button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { FONT_LIBRARY, resolveFace } from '@/constants/fonts';
import { hitTarget, spacing } from '@/constants/tokens';
import { TEXT_MAX_LENGTH } from '@/features/quote-card/types';
import { useTopics } from '@/hooks/use-discover';
import { useTheme } from '@/hooks/use-theme';
import { showActions } from '@/lib/action-sheet';

import { useComposer } from './store';

// Optical sizes so every family feels equally large on the blank page.
const SIZE_BY_CATEGORY = { serif: 30, sans: 27, mono: 22, script: 36 } as const;

/** Step 1: a blank page, not a form. Written in the card's typeface as a gentle preview. */
export function WriteStep({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const text = useComposer((s) => s.text);
  const setText = useComposer((s) => s.setText);
  const font = useComposer((s) => s.design.font);
  const weight = useComposer((s) => s.design.weight);
  const italic = useComposer((s) => s.design.italic);
  const size = SIZE_BY_CATEGORY[FONT_LIBRARY[font].category];
  const canContinue = text.trim().length > 0;
  const remaining = TEXT_MAX_LENGTH - text.length;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton icon="close" onPress={onClose} />
        <Pressable
          onPress={onNext}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="Next: design your card"
          accessibilityState={{ disabled: !canContinue }}
          style={[styles.next, { backgroundColor: theme.primary, opacity: canContinue ? 1 : 0.3 }]}>
          <Text variant="subhead" style={{ color: theme.onPrimary }}>
            Design
          </Text>
          <Icon name="chevron.right" size={12} color={theme.onPrimary} weight="bold" />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.body}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What’s on your mind?"
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.accent}
          multiline
          autoFocus
          scrollEnabled
          maxLength={TEXT_MAX_LENGTH}
          textAlignVertical="top"
          accessibilityLabel="Your thought"
          style={[
            styles.input,
            { color: theme.text, fontFamily: resolveFace(font, weight, italic), fontSize: size, lineHeight: size * 1.25 },
          ]}
        />
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TopicPill />
          <Text variant="caption" color={remaining < 40 ? 'accent' : 'textTertiary'} style={styles.count}>
            {text.length}/{TEXT_MAX_LENGTH}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Optional Discover topic, so the card can be found under e.g. "Healing". */
function TopicPill() {
  const theme = useTheme();
  const topic = useComposer((s) => s.topic);
  const setTopic = useComposer((s) => s.setTopic);
  const { data: topics } = useTopics();
  const label = topics?.find((t) => t.slug === topic)?.label;

  const choose = () => {
    if (!topics) return;
    showActions(
      [
        ...topics.map((t) => ({ label: t.label, onPress: () => setTopic(t.slug) })),
        ...(topic ? [{ label: 'No topic', destructive: true, onPress: () => setTopic(null) }] : []),
      ],
      'Topic',
    );
  };

  return (
    <Pressable
      onPress={choose}
      accessibilityRole="button"
      accessibilityLabel={label ? `Topic: ${label}. Change topic` : 'Add a topic'}
      hitSlop={8}
      style={[styles.topic, { backgroundColor: label ? theme.accentSoft : theme.surface }]}>
      <Icon name="hashtag" size={13} color={label ? theme.accent : theme.textSecondary} weight="semibold" />
      <Text variant="subhead" color={label ? 'accent' : 'textSecondary'}>
        {label ?? 'Add topic'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    minHeight: hitTarget + spacing.sm,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
  },
  body: { flex: 1 },
  input: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  topic: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 32, paddingHorizontal: spacing.sm + 4, borderRadius: 16 },
  count: { fontVariant: ['tabular-nums'] },
});
