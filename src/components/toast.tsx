import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { create } from 'zustand';

import { radius, shadows, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './ui/text';

interface ToastState {
  message: string | null;
  key: number;
}

const useToastStore = create<ToastState>()(() => ({ message: null, key: 0 }));
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** Shows a short, quiet confirmation (or error) above the tab bar. */
export function toast(message: string) {
  clearTimeout(hideTimer);
  useToastStore.setState((s) => ({ message, key: s.key + 1 }));
  AccessibilityInfo.announceForAccessibility(message);
  hideTimer = setTimeout(() => useToastStore.setState({ message: null }), 2400);
}

export function Toaster() {
  const { message, key } = useToastStore();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Above every sheet and modal, so confirmations from the share sheet are seen.
  return (
    <FullWindowOverlay>
      {message && (
        <Animated.View
          key={key}
          entering={reduceMotion ? FadeIn : FadeInDown.springify().damping(18)}
          exiting={FadeOut.duration(200)}
          pointerEvents="none"
          style={[styles.wrap, { bottom: insets.bottom + 76 }]}>
          <View style={[styles.pill, shadows.card, { backgroundColor: theme.primary }]}>
            <Text variant="subhead" style={{ color: theme.onPrimary }} numberOfLines={2}>
              {message}
            </Text>
          </View>
        </Animated.View>
      )}
    </FullWindowOverlay>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  pill: { paddingHorizontal: spacing.md + 4, paddingVertical: spacing.sm + 4, borderRadius: radius.pill },
});
