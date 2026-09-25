import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { QuoteCard } from '@/features/quote-card/quote-card';
import type { FeedPost } from '@/types/models';

interface LikeableCardProps {
  post: FeedPost;
  width: number;
  /** Double tap only ever likes (never unlikes), like every photo app. */
  onLike: () => void;
}

/** A post's QuoteCard with double-tap-to-like and a subtle heart that blooms and fades. */
export const LikeableCard = memo(function LikeableCard({ post, width, onLike }: LikeableCardProps) {
  const [burst, setBurst] = useState(0);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .runOnJS(true)
    .onEnd((_event, success) => {
      if (!success) return;
      setBurst((n) => n + 1);
      onLike();
    });

  return (
    <GestureDetector gesture={doubleTap}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${post.text.trim()} — quote card by ${post.author.displayName}`}
        accessibilityActions={[{ name: 'like', label: post.likedByMe ? 'Liked' : 'Like' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'like' && onLike()}>
        <QuoteCard text={post.text} design={post.design} author={post.author} width={width} />
        <HeartBurst trigger={burst} />
      </View>
    </GestureDetector>
  );
});

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
});
