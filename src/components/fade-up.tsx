import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/** Dicta's entrance curve: a quick start and a long settle. */
export const ENTRANCE_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
/** The gap between items of a staggered entrance, in ms. */
export const STAGGER_MS = 60;

interface FadeUpProps {
  /** When this item starts, in ms after it mounts. */
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fades its content in while it rises 16pt into place, once per mount. Only
 * opacity and transform change, so the layout never shifts; under Reduce
 * Motion it just fades.
 */
export function FadeUp({ delay = 0, children, style }: FadeUpProps) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.set(withDelay(delay, withTiming(1, { duration: 560, easing: ENTRANCE_EASING })));
  }, [delay, shown]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: reduceMotion ? 0 : (1 - shown.get()) * 16 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
