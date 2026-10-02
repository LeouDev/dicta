import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import type { CardAuthor } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/action-sheet';

import { MAX_STACK, stackOf, useComposer } from './store';

const THUMB = 30;

/**
 * A stack's cards under the preview: tap one to edit it, + to add the next
 * (styled like the current one, up to 10), press and hold to remove one.
 */
export function CardStrip({ author, onAdded }: { author: CardAuthor; onAdded: () => void }) {
  const theme = useTheme();
  const text = useComposer((s) => s.text);
  const design = useComposer((s) => s.design);
  const cards = useComposer((s) => s.cards);
  const current = useComposer((s) => s.current);
  const stack = useMemo(() => stackOf({ text, design, cards, current }), [text, design, cards, current]);
  const stacked = stack.length > 1;

  const add = () => {
    Haptics.selectionAsync();
    useComposer.getState().addCard();
    onAdded();
  };
  const remove = (index: number) =>
    confirm(`Remove card ${index + 1}?`, 'Its words and design go with it.', 'Remove', () => useComposer.getState().removeCard(index));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.scroll}>
      {stacked &&
        stack.map((card, i) => (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.selectionAsync();
              useComposer.getState().selectCard(i);
            }}
            onLongPress={() => remove(i)}
            accessibilityRole="button"
            accessibilityLabel={`Card ${i + 1}${i === current ? ', editing' : ''}`}
            accessibilityHint="Edits this card. Press and hold to remove it."
            accessibilityActions={[{ name: 'delete', label: 'Remove card' }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && remove(i)}
            style={[styles.thumb, { borderColor: i === current ? theme.text : 'transparent' }]}>
            <QuoteCard text={card.text || ' '} design={card.design} author={author} width={THUMB} radius={radius.xs} />
          </Pressable>
        ))}
      {stack.length < MAX_STACK && (
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel={stacked ? 'Add a card' : 'Add a card, making this a stack people swipe through'}
          style={[styles.add, { backgroundColor: theme.surface }, !stacked && styles.addWide]}>
          <Icon name="plus" size={14} color={theme.text} weight="semibold" />
          {!stacked && (
            <Text variant="subhead" color="text">
              Add card
            </Text>
          )}
        </Pressable>
      )}
      {stacked && (
        <View style={styles.count}>
          <Text variant="caption" color="textTertiary">
            {stack.length}/{MAX_STACK}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  strip: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  thumb: { padding: 2, borderWidth: 1.5, borderRadius: radius.xs + 3 },
  add: { height: 34, minWidth: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  addWide: { paddingHorizontal: spacing.md },
  count: { paddingLeft: spacing.xs },
});
