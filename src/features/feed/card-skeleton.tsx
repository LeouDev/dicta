import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

/** Placeholder cards with a slow breathing pulse (static under Reduce Motion). */
export function CardSkeleton({ width, count = 2, ratio = 4 / 5 }: { width: number; count?: number; ratio?: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) opacity.set(withRepeat(withTiming(0.55, { duration: 900 }), -1, true));
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <Animated.View key={i} style={[style, styles.item]}>
          <View style={{ width, height: width / ratio, borderRadius: radius.lg, backgroundColor: theme.skeleton }} />
          <View style={[styles.line, { backgroundColor: theme.skeleton }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignItems: 'center', paddingTop: spacing.sm },
  item: { paddingBottom: spacing.xl },
  line: { width: 120, height: 12, borderRadius: 6, marginTop: spacing.md },
});
