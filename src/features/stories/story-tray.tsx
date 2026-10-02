import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { spacing } from '@/constants/tokens';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useStoryTray } from '@/hooks/use-stories';
import { useTheme } from '@/hooks/use-theme';
import { profileToAuthor, type StoryRing } from '@/types/models';

const AVATAR = 60;
/** The ring around an avatar, and the gap between it and the photo. */
const RING = 2.5;
const GAP = 2.5;

export const openStoryComposer = () => {
  Haptics.selectionAsync();
  router.push('/create?mode=story');
};

/**
 * The rings at the top of Home: yours first (tap to add a story, or to watch
 * yours), then people you follow with a live story, unseen ones ringed in color.
 */
export function StoryTray() {
  const theme = useTheme();
  const { data: me } = useMyProfile();
  const tray = useStoryTray();
  if (!me) return null;

  const mine = tray.data?.find((ring) => ring.author.id === me.id);
  const others = (tray.data ?? []).filter((ring) => ring.author.id !== me.id);
  // Your own views aren't recorded (you'd count as a viewer), so your ring never reads as new.
  const own: StoryRing = mine ? { ...mine, unseen: false } : { author: profileToAuthor(me), latestAt: '', unseen: false };

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={[own, ...others]}
      keyExtractor={(ring) => ring.author.id}
      contentContainerStyle={styles.list}
      style={[styles.tray, { borderBottomColor: theme.hairline }]}
      renderItem={({ item, index }) =>
        index === 0 ? (
          <Ring
            ring={item}
            label="Your story"
            hasStory={Boolean(mine)}
            onPress={() => (mine ? router.push(`/story/${me.id}`) : openStoryComposer())}
            onLongPress={openStoryComposer}
            add
          />
        ) : (
          <Ring ring={item} label={item.author.displayName} hasStory onPress={() => router.push(`/story/${item.author.id}`)} />
        )
      }
    />
  );
}

const Ring = memo(function Ring({
  ring,
  label,
  hasStory,
  add,
  onPress,
  onLongPress,
}: {
  ring: StoryRing;
  label: string;
  hasStory: boolean;
  add?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  const color = !hasStory ? 'transparent' : ring.unseen ? theme.accent : theme.hairline;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={add ? (hasStory ? 'Your story. Press and hold to add another' : 'Add to your story') : `${label}’s story${ring.unseen ? ', new' : ''}`}
      style={styles.item}>
      <View style={[styles.ring, { borderColor: color }]}>
        <UserAvatar uri={ring.author.avatarUrl} name={ring.author.displayName} size={AVATAR} />
      </View>
      {add && !hasStory && (
        <View style={[styles.plus, { backgroundColor: theme.accent, borderColor: theme.background }]}>
          <Icon name="plus" size={12} color={theme.onAccent} weight="bold" />
        </View>
      )}
      <Text variant="caption" color={ring.unseen ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
});

const SIZE = AVATAR + (RING + GAP) * 2;

const styles = StyleSheet.create({
  // Edge to edge: the feed's list is inset by spacing.md.
  tray: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm, marginHorizontal: -spacing.md },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  item: { width: SIZE + 4, alignItems: 'center', gap: spacing.xs },
  ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: RING, padding: GAP - 0.5, alignItems: 'center', justifyContent: 'center' },
  plus: {
    position: 'absolute',
    top: SIZE - 22,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { maxWidth: SIZE + 4, textAlign: 'center' },
});
