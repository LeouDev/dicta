import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hitTarget, radius, spacing } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './ui/icon';
import { PressableScale } from './ui/pressable-scale';
import { UserAvatar } from './user-avatar';

const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  discover: 'discover',
  activity: 'activity',
};

/**
 * Icon-only tab bar with a distinct Create button in the middle. Create is a
 * modal route, not a tab, so it always opens on top of whatever you're viewing.
 */
export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: profile } = useMyProfile();

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
    const color = focused ? theme.text : theme.textTertiary;
    const baseIcon = TAB_ICONS[route.name];

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.title ?? route.name}
        style={styles.tab}>
        {baseIcon ? (
          <Icon name={(focused ? `${baseIcon}.fill` : baseIcon) as IconName} size={24} color={color} />
        ) : (
          <View style={[styles.avatarRing, { borderColor: focused ? theme.text : 'transparent' }]}>
            <UserAvatar uri={profile?.avatar_url} name={profile?.display_name} size={26} />
          </View>
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
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm), backgroundColor: theme.background, borderTopColor: theme.hairline },
      ]}>
      {tabs.slice(0, 2)}
      {createButton}
      {tabs.slice(2)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: hitTarget },
  create: {
    width: 52,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: { padding: 1.5, borderRadius: radius.pill, borderWidth: 1.5 },
});
