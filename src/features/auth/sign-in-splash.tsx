import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { ENTRANCE_EASING } from '@/components/fade-up';
import { wordmarkStyle } from '@/components/wordmark';
import { shadows } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

const EMBLEM = require('@/assets/images/emblem.png');
const EXIT_EASING = Easing.bezier(0.5, 0, 0.2, 1);
const WORDMARK_SIZE = 30;

// The timeline, in ms after sign-in opens.
const EMBLEM_IN = 100;
const LETTERS_IN = 600;
const LETTER_STAGGER = 70;
const EMBLEM_OUT = 1750;
const COVER_OUT = 1830;
const COVER_FADE = 480;
/** When the sign-in form starts rising in, in ms after sign-in opens. */
export const SPLASH_MS = 1970;

/**
 * The emblem and the wordmark, drawn in and lifted away over the sign-in form,
 * once each time sign-in opens. Skipped under Reduce Motion.
 */
export function SignInSplash() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const emblemIn = useSharedValue(0);
  const emblemOut = useSharedValue(0);
  const cover = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    emblemIn.set(withDelay(EMBLEM_IN, withTiming(1, { duration: 800, easing: ENTRANCE_EASING })));
    emblemOut.set(withDelay(EMBLEM_OUT, withTiming(1, { duration: 500, easing: EXIT_EASING })));
    cover.set(withDelay(COVER_OUT, withTiming(0, { duration: COVER_FADE, easing: ENTRANCE_EASING })));
    const timer = setTimeout(() => setDone(true), COVER_OUT + COVER_FADE);
    return () => clearTimeout(timer);
  }, [reduceMotion, emblemIn, emblemOut, cover]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  const emblemStyle = useAnimatedStyle(() => {
    const shown = emblemIn.get();
    const leaving = emblemOut.get();
    return {
      opacity: shown * (1 - leaving),
      transform: [
        { translateY: -24 * leaving },
        { scale: (0.82 + 0.18 * shown) * (1 + 0.06 * leaving) },
        { rotate: `${-8 * (1 - shown)}deg` },
      ],
    };
  });

  if (reduceMotion || done) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: theme.background }, coverStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={[shadows.lifted, emblemStyle]}>
        <Image source={EMBLEM} style={styles.emblem} contentFit="contain" />
      </Animated.View>
      <View style={styles.wordmark}>
        {'DICTA'.split('').map((letter, i) => (
          <Letter key={letter} letter={letter} delay={LETTERS_IN + i * LETTER_STAGGER} />
        ))}
      </View>
    </Animated.View>
  );
}

function Letter({ letter, delay }: { letter: string; delay: number }) {
  const theme = useTheme();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.set(withDelay(delay, withTiming(1, { duration: 520, easing: ENTRANCE_EASING })));
  }, [delay, shown]);

  const style = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: 10 * (1 - shown.get()) }] }));
  return (
    <Animated.Text allowFontScaling={false} style={[wordmarkStyle(WORDMARK_SIZE, theme.accent), style]}>
      {letter}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', gap: 28 },
  emblem: { width: 176, height: 176 },
  wordmark: { flexDirection: 'row' },
});
