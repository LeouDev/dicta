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
import { UserAvatar } from '@/components/user-avatar';
import { Wordmark } from '@/components/wordmark';
import { radius, shadows, spacing, typography } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

// Sample card designs are content, not chrome, so they carry their own colors.
const SLIDES = [
  {
    headline: 'Your thoughts deserve more than plain text.',
    card: {
      text: 'Some thoughts are too beautiful to stay in your notes app.',
      background: '#F4EEE3',
      color: '#8E1B1B',
      fontFamily: 'DMSerifDisplay_400Regular',
      fontSize: 25,
      lineHeight: 28,
      rotate: -3,
      header: true,
    },
  },
  {
    headline: 'Turn words into something worth sharing.',
    card: {
      text: 'Say it once.\nSay it beautifully.',
      background: '#151413',
      color: '#F4EFE8',
      fontFamily: 'CormorantGaramond_600SemiBold',
      fontSize: 30,
      lineHeight: 34,
      rotate: 2.5,
      header: false,
    },
  },
  {
    headline: 'Follow people whose words inspire you.',
    card: {
      text: 'Find the ones whose words feel like home.',
      background: '#FBF8F1',
      color: '#1E2A4A',
      fontFamily: 'Caveat_600SemiBold',
      fontSize: 32,
      lineHeight: 34,
      rotate: -2,
      header: false,
    },
  },
] as const;

type Slide = (typeof SLIDES)[number];

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
  const { card } = slide;

  const cardStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ rotate: `${card.rotate}deg` }] };
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.get(), input, [0.3, 1, 0.3], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(scrollX.get(), input, [width * 0.25, 0, -width * 0.25], Extrapolation.CLAMP) },
        { rotate: `${interpolate(scrollX.get(), input, [card.rotate * 3, card.rotate, card.rotate * -2], Extrapolation.CLAMP)}deg` },
      ],
    };
  });

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.cardArea}>
        <Animated.View
          accessible
          accessibilityLabel={`Example quote card: ${card.text.replace('\n', ' ')}`}
          style={[styles.card, shadows.lifted, { width: cardWidth, backgroundColor: card.background }, cardStyle]}>
          {card.header && (
            <View style={styles.cardHeader}>
              <UserAvatar name="Mara Vell" size={26} />
              <View>
                <Text style={[styles.cardName, { color: '#1A1714' }]}>Mara Vell</Text>
                <Text style={[styles.cardHandle, { color: '#6B645C' }]}>@maravell</Text>
              </View>
            </View>
          )}
          <Text
            allowFontScaling={false}
            style={{ color: card.color, fontFamily: card.fontFamily, fontSize: card.fontSize, lineHeight: card.lineHeight, textAlign: 'center' }}>
            {card.text}
          </Text>
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
  card: {
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center' },
  cardName: { fontSize: 12, fontWeight: '700' },
  cardHandle: { fontSize: 10 },
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
