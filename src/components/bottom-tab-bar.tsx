import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BottomTabBarHeightCallbackContext, BottomTabBarHeightContext, type BottomTabBarProps } from 'expo-router/tabs';
import { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, shadows, spacing } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useUnreadCount } from '@/hooks/use-notifications';
import { useSchemeName, useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './ui/icon';
import { PressableScale } from './ui/pressable-scale';
import { Text } from './ui/text';
import { UserAvatar } from './user-avatar';

const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  discover: 'discover',
  activity: 'activity',
};

/** Five equal slots: the four tabs, with Create in the middle. */
const SLOTS = 5;
const CREATE_SLOT = 2;
const BAR_HEIGHT = 60;
const BAR_PADDING = 6;
const GLASS = isLiquidGlassAvailable();

/** How far the floating tab bar reaches up a tab screen (0 outside the tabs), so lists can scroll clear of it. */
export function useTabBarSpace() {
  return useContext(BottomTabBarHeightContext) ?? 0;
}

/**
 * Icon-only tab bar floating over the content on Liquid Glass (iOS 26; a
 * raised bar before), with a distinct Create button in the middle. Create is a
 * modal route, not a tab, so it always opens on top of whatever you're viewing.
 */
export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const scheme = useSchemeName();
  const insets = useSafeAreaInsets();
  const { data: profile } = useMyProfile();
  const unread = useUnreadCount().data ?? 0;

  const bottom = Math.max(insets.bottom - 12, spacing.md);
  const setSpace = useContext(BottomTabBarHeightCallbackContext);
  useEffect(() => setSpace?.(bottom + BAR_HEIGHT), [bottom, setSpace]);

  // The bubble behind the current tab slides between slots, as iOS 26's does.
  const [slotWidth, setSlotWidth] = useState(0);
  const slot = state.index < CREATE_SLOT ? state.index : state.index + 1;
  const bubbleX = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!slotWidth) return;
    bubbleX.set(placed.current ? withSpring(slot * slotWidth, { damping: 20, stiffness: 240 }) : slot * slotWidth);
    placed.current = true;
  }, [bubbleX, slot, slotWidth]);
  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: bubbleX.get() }] }));

  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    const { options } = descriptors[route.key];
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        Haptics.selectionAsync();
        navigation.navigate(route.name, route.params);
      }
    };
    const color = focused ? theme.text : theme.textSecondary;
    const baseIcon = TAB_ICONS[route.name];
    const badge = route.name === 'activity' && unread > 0 ? (unread > 9 ? '9+' : String(unread)) : null;

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={`${options.title ?? route.name}${badge ? `, ${unread} unread` : ''}`}
        style={styles.tab}>
        {baseIcon ? (
          <View>
            <Icon name={(focused ? `${baseIcon}.fill` : baseIcon) as IconName} size={24} color={color} />
            {badge && (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <Text variant="caption" style={[styles.badgeText, { color: theme.onAccent }]} allowFontScaling={false}>
                  {badge}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <UserAvatar uri={profile?.avatar_url} name={profile?.display_name} size={28} />
        )}
      </Pressable>
    );
  });

  const createButton = (
    <View key="create" style={styles.tab}>
      <PressableScale
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/create');
        }}
        accessibilityLabel="Create a post"
        accessibilityHint="Opens the quote card editor"
        style={[styles.create, { backgroundColor: theme.primary }]}>
        <Icon name="plus" size={20} color={theme.onPrimary} weight="semibold" />
      </PressableScale>
    </View>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <GlassView
        isInteractive
        // Glass darkens over dark content, but these icons don't flip like the
        // system's do: a tint of the page color keeps them readable on anything.
        colorScheme={scheme}
        tintColor={scheme === 'dark' ? 'rgba(18, 17, 16, 0.55)' : 'rgba(247, 243, 236, 0.72)'}
        onLayout={(e) => setSlotWidth((e.nativeEvent.layout.width - BAR_PADDING * 2) / SLOTS)}
        style={[styles.bar, !GLASS && [styles.raised, { backgroundColor: theme.surfaceRaised, borderColor: theme.hairline }]]}>
        {slotWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              { width: slotWidth, backgroundColor: scheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(26, 23, 20, 0.07)' },
              bubbleStyle,
            ]}
          />
        )}
        {tabs.slice(0, CREATE_SLOT)}
        {createButton}
        {tabs.slice(CREATE_SLOT)}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    padding: BAR_PADDING,
    borderRadius: BAR_HEIGHT / 2,
  },
  raised: { borderWidth: StyleSheet.hairlineWidth, ...shadows.card },
  bubble: {
    position: 'absolute',
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
    borderRadius: radius.pill,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  create: {
    width: 52,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    left: 14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0 },
});
