import { KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/back-button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { hitTarget, spacing } from '@/constants/tokens';
import { TEXT_MAX_LENGTH } from '@/features/quote-card/types';
import { useTopics } from '@/hooks/use-discover';
import { useTheme } from '@/hooks/use-theme';
import { showActions } from '@/lib/action-sheet';

import { useComposer } from './store';

/** Step 1: a blank page, not a form, written in a casual mono at Threads' size; the card's typeface comes next. */
export function WriteStep({ onNext, onClose }: { onNext: () => void; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const text = useComposer((s) => s.text);
  const setText = useComposer((s) => s.setText);
  const verse = useComposer((s) => s.design.composition === 'verse');
  const story = useComposer((s) => s.story);
  // In a stack, which card these words are for.
  const card = useComposer((s) => (s.cards.length > 1 ? `Card ${s.current + 1} of ${s.cards.length}` : null));
  const canContinue = text.trim().length > 0;
  const remaining = TEXT_MAX_LENGTH - text.length;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton icon="close" onPress={onClose} />
        {card && !canContinue ? (
          // A card added by mistake: the way back to Design without typing.
          <Pressable
            onPress={() => {
              const composer = useComposer.getState();
              composer.removeCard(composer.current);
              onNext();
            }}
            accessibilityRole="button"
            hitSlop={8}>
            <Text variant="subhead" color="accent">
              Remove card
            </Text>
          </Pressable>
        ) : (
          (card || story) && (
            <Text variant="subhead" color="textSecondary">
              {story ? 'Your story' : card}
            </Text>
          )
        )}
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
          placeholder={story ? 'What’s on your mind today?' : card ? 'The words for this card' : 'What’s on your mind?'}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.accent}
          multiline
          autoFocus
          scrollEnabled
          maxLength={TEXT_MAX_LENGTH}
          textAlignVertical="top"
          accessibilityLabel="Your thought"
          style={[styles.input, { color: theme.text }]}
        />
        {verse && (
          <Text variant="caption" color="textTertiary" style={styles.tip}>
            Verse: put a word between asterisks, like *Glory*, to set it in script among the small capitals.
          </Text>
        )}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {story ? <View /> : <TopicPill />}
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
  // SF Mono, iOS's own monospace (Aptos Mono can't be built into an app).
  input: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, fontFamily: 'ui-monospace', fontSize: 15, lineHeight: 21 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  topic: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: 32, paddingHorizontal: spacing.sm + 4, borderRadius: 16 },
  count: { fontVariant: ['tabular-nums'] },
  tip: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
