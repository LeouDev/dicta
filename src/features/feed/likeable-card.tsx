import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { spacing } from '@/constants/tokens';
import { plainText } from '@/features/quote-card/flow';
import { cardSize } from '@/features/quote-card/geometry';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { toggleSound, useSoundOwner } from '@/features/sound/player';
import { SoundButton } from '@/features/sound/sound-button';
import { useTheme } from '@/hooks/use-theme';
import type { CardContent, FeedPost } from '@/types/models';

interface LikeableCardProps {
  post: FeedPost;
  width: number;
  /** Double tap only ever likes (never unlikes), like every photo app. */
  onLike: () => void;
  /** A stack's card coming into view (0 is the first). */
  onCardChange?: (index: number) => void;
}

/**
 * A post's QuoteCard with double-tap-to-like, a subtle heart that blooms and
 * fades, and its sound if it has one. A stacked post swipes through its cards,
 * with dots below.
 */
export const LikeableCard = memo(function LikeableCard({ post, width, onLike, onCardChange }: LikeableCardProps) {
  const [burst, setBurst] = useState(0);
  const [picked, setPicked] = useState({ id: post.id, index: 0 });
  const pager = useRef<FlatList<CardContent>>(null);
  const { sound } = post.design;
  const playing = useSoundOwner((s) => s.owner === post.id);
  const cards = useMemo(() => [{ text: post.text, design: post.design }, ...post.cards], [post.text, post.design, post.cards]);
  const stacked = cards.length > 1;
  const height = Math.max(...cards.map((card) => cardSize('original', card.design.canvas, width).height));
  // The feed reuses this cell for other posts, and an edit can shorten the stack under you.
  const index = picked.id === post.id ? Math.min(picked.index, cards.length - 1) : 0;

  const show = (next: number) => {
    const clamped = Math.max(0, Math.min(cards.length - 1, next));
    if (clamped === index) return;
    setPicked({ id: post.id, index: clamped });
    onCardChange?.(clamped);
  };
  const go = (next: number) => {
    pager.current?.scrollToIndex({ index: Math.max(0, Math.min(cards.length - 1, next)), animated: true });
    show(next);
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .runOnJS(true)
    .onEnd((_event, success) => {
      if (!success) return;
      setBurst((n) => n + 1);
      onLike();
    });

  const label = `${plainText(cards[index].text, cards[index].design).trim()} — quote card by ${post.author.displayName}`;

  return (
    <>
      <GestureDetector gesture={doubleTap}>
        <View
          accessible
          accessibilityRole={stacked ? 'adjustable' : 'image'}
          accessibilityLabel={label}
          accessibilityValue={stacked ? { text: `Card ${index + 1} of ${cards.length}` } : undefined}
          accessibilityActions={[
            { name: 'like', label: post.likedByMe ? 'Liked' : 'Like' },
            ...(stacked ? [{ name: 'increment' as const }, { name: 'decrement' as const }] : []),
            ...(sound ? [{ name: 'sound', label: playing ? 'Stop sound' : 'Play sound' }] : []),
          ]}
          onAccessibilityAction={(e) => {
            const action = e.nativeEvent.actionName;
            if (action === 'like') onLike();
            if (action === 'increment') go(index + 1);
            if (action === 'decrement') go(index - 1);
            if (action === 'sound' && sound) toggleSound(sound, post.id);
          }}>
          {stacked ? (
            <FlatList
              key={post.id}
              ref={pager}
              data={cards}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => show(Math.round(e.nativeEvent.contentOffset.x / width))}
              style={{ width, height }}
              renderItem={({ item }) => (
                <View style={[styles.page, { width, height }]}>
                  <QuoteCard text={item.text} design={item.design} author={post.author} width={width} />
                </View>
              )}
            />
          ) : (
            <QuoteCard text={post.text} design={post.design} author={post.author} width={width} />
          )}
          <HeartBurst trigger={burst} />
          {sound && <SoundButton sound={sound} owner={post.id} />}
          {stacked && <StackMark />}
        </View>
      </GestureDetector>
      {stacked && <Dots count={cards.length} index={index} />}
    </>
  );
});

/** The stack icon in the corner, so a stack reads as one before you swipe. */
function StackMark() {
  return (
    <View pointerEvents="none" style={styles.mark}>
      <Icon name="stack" size={12} color="#FFFFFF" weight="semibold" />
    </View>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.hairline }]} />
      ))}
    </View>
  );
}

function HeartBurst({ trigger }: { trigger: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0) return;
    scale.set(reduceMotion ? 1 : 0.6);
    if (!reduceMotion) scale.set(withSequence(withSpring(1.1, { damping: 10, stiffness: 280 }), withTiming(1, { duration: 140 })));
    opacity.set(withSequence(withTiming(0.95, { duration: 110 }), withDelay(380, withTiming(0, { duration: 280 }))));
  }, [trigger, reduceMotion, scale, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, style]}>
      <View style={styles.shadow}>
        <Icon name="heart.fill" size={92} color="#FFFFFF" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  shadow: { shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  page: { justifyContent: 'center' },
  mark: {
    position: 'absolute',
    top: spacing.sm + 2,
    right: spacing.sm + 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: spacing.sm + 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
