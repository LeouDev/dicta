import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProfileHeader } from '@/components/profile-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { hitTarget, spacing } from '@/constants/tokens';
import { PostGrid } from '@/features/feed/post-grid';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useSavedPosts, useUserPosts } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';

type Tab = 'posts' | 'saved';

export default function ProfileScreen() {
  const theme = useTheme();
  const { data: profile } = useMyProfile();
  const [tab, setTab] = useState<Tab>('posts');
  const [savedOpened, setSavedOpened] = useState(false);
  const posts = useUserPosts(profile?.id ?? null);
  // Saved loads the first time it's opened, then stays warm.
  const saved = useSavedPosts(savedOpened);

  const select = (next: Tab) => {
    if (next === 'saved') setSavedOpened(true);
    setTab(next);
  };

  const header = (
    <View style={styles.profile}>
      {profile && (
        <ProfileHeader
          profile={profile}
          actions={<Button label="Edit profile" variant="secondary" size="sm" onPress={() => router.push('/settings/edit-profile')} style={styles.edit} />}
        />
      )}
      <View style={[styles.tabs, { borderBottomColor: theme.hairline }]} accessibilityRole="tablist">
        {(['posts', 'saved'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => select(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[styles.tab, { borderBottomColor: tab === t ? theme.text : 'transparent' }]}>
            <Icon name={t === 'posts' ? 'photo' : tab === t ? 'bookmark.fill' : 'bookmark'} size={17} color={tab === t ? theme.text : theme.textTertiary} />
            <Text variant="subhead" color={tab === t ? 'text' : 'textTertiary'}>
              {t === 'posts' ? 'Posts' : 'Saved'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Screen edges={['top']} contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <ScreenHeader
          title=""
          right={
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" style={styles.iconButton}>
              <Icon name="settings" size={22} color={theme.text} />
            </Pressable>
          }
        />
      </View>

      <PostGrid
        key={tab}
        query={tab === 'posts' ? posts : saved}
        header={header}
        empty={
          tab === 'posts' ? (
            <EmptyState
              title="Your gallery is empty"
              message="Every card you publish lands here."
              actionLabel="Create your first card"
              onAction={() => router.push('/create')}
            />
          ) : (
            <EmptyState title="Nothing saved yet" message="Tap the bookmark on any quote to keep it here. Only you can see what you save." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  topBar: { paddingHorizontal: spacing.lg },
  iconButton: { width: hitTarget, height: hitTarget, alignItems: 'flex-end', justifyContent: 'center' },
  profile: { paddingBottom: spacing.md, paddingHorizontal: spacing.sm },
  edit: { minWidth: 132 },
  tabs: { flexDirection: 'row', marginTop: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    minHeight: hitTarget,
    borderBottomWidth: 1.5,
    marginBottom: -StyleSheet.hairlineWidth,
  },
});
