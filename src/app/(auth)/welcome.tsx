import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Wordmark } from '@/components/wordmark';
import { shadows, spacing, typography } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { createDesign, suggestedFontSize } from '@/features/quote-card/templates';
import type { CardAuthor, TemplateId } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

const SAMPLE_AUTHOR: CardAuthor = { displayName: 'Mara Vell', username: 'maravell', avatarUrl: null, isVerified: false };

// Real cards from the same renderer people will use, tilted like prints on a table.
const SLIDES = [
  {
    headline: 'Your thoughts deserve more than plain text.',
    text: 'Some thoughts are too beautiful to stay in your notes app.',
    template: 'editorial',
    rotate: -3,
  },
  {
    headline: 'Turn words into something worth sharing.',
    text: 'Say it once.\nSay it beautifully.',
    template: 'midnight',
    rotate: 2.5,
  },
  {
    headline: 'Follow people whose words inspire you.',
    text: 'Find the ones whose words feel like home.',
    template: 'journal',
    rotate: -2,
  },
] satisfies { headline: string; text: string; template: TemplateId; rotate: number }[];

type Slide = (typeof SLIDES)[number];

// Built once so QuoteCard's memoized layout isn't recomputed on every render.
const DESIGNS = SLIDES.map((slide) => ({ ...createDesign(slide.template), fontSize: suggestedFontSize(slide.template, slide.text.length) }));

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.top}>
        <Wordmark size={18} />
      </View>

      <Animated.FlatList
        data={SLIDES}
        keyExtractor={(item) => item.headline}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => <SlideView slide={item} index={index} width={width} scrollX={scrollX} />}
        style={styles.pager}
      />

      <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${SLIDES.length}`}>
        {SLIDES.map((slide, i) => (
          <Dot key={slide.headline} index={i} width={width} scrollX={scrollX} />
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Create your profile" onPress={() => router.push('/sign-up')} />
        <Button label="I already have an account" variant="ghost" onPress={() => router.push('/sign-in')} />
      </View>
    </Screen>
  );
}

function SlideView({ slide, index, width, scrollX }: { slide: Slide; index: number; width: number; scrollX: SharedValue<number> }) {
  const reduceMotion = useReducedMotion();
  const cardWidth = Math.min(width * 0.66, 290);

  const cardStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ rotate: `${slide.rotate}deg` }] };
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.get(), input, [0.3, 1, 0.3], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(scrollX.get(), input, [width * 0.25, 0, -width * 0.25], Extrapolation.CLAMP) },
        { rotate: `${interpolate(scrollX.get(), input, [slide.rotate * 3, slide.rotate, slide.rotate * -2], Extrapolation.CLAMP)}deg` },
      ],
    };
  });

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.cardArea}>
        <Animated.View style={[shadows.lifted, cardStyle]}>
          <QuoteCard text={slide.text} design={DESIGNS[index]} author={SAMPLE_AUTHOR} width={cardWidth} />
        </Animated.View>
      </View>
      <Text variant="display" align="center" style={styles.headline}>
        {slide.headline}
      </Text>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.get(), input, [6, 22, 6], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.get(), input, [0.25, 1, 0.25], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: theme.text }, style]} />;
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  top: { alignItems: 'center', paddingTop: spacing.sm },
  pager: { flexGrow: 1 },
  slide: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 260 },
  // Fixed three-line height keeps the card from jumping between slides.
  headline: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: typography.display.lineHeight * 3,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.lg },
  dot: { height: 6, borderRadius: 3 },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: spacing.sm },
});
