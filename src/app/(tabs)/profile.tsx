import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ProfileHeader } from '@/components/profile-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { CardSkeleton } from '@/features/feed/card-skeleton';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useUserPosts } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';
import { signOut } from '@/services/auth';
import { friendlyError } from '@/services/errors';

const GUTTER = spacing.md;
const GAP = spacing.sm + 4;

export default function ProfileScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { data: profile } = useMyProfile();
  const posts = useUserPosts(profile?.id ?? null);
  const [pulling, setPulling] = useState(false);
  const items = posts.data?.pages.flat() ?? [];
  const tileWidth = (width - GUTTER * 2 - GAP) / 2;

  const confirmSignOut = () =>
    Alert.alert('Sign out of Dicta?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut().catch((e) => Alert.alert('Couldn’t sign out', friendlyError(e))),
      },
    ]);

  const header = (
    <View style={[styles.profile, { marginHorizontal: GAP / 2 }]}>
      {profile && <ProfileHeader profile={profile} />}
    </View>
  );

  return (
    <Screen edges={['top']} contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <ScreenHeader
          title=""
          right={
            <Pressable onPress={confirmSignOut} accessibilityRole="button" accessibilityLabel="Settings" style={styles.iconButton}>
              <Icon name="settings" size={22} color={theme.text} />
            </Pressable>
          }
        />
      </View>

      <FlashList
        data={items}
        masonry
        numColumns={2}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.tile}>
            <QuoteCard text={item.text} design={item.design} author={item.author} width={tileWidth} radius={radius.md} />
          </View>
        )}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (posts.hasNextPage && !posts.isFetchingNextPage) posts.fetchNextPage();
        }}
        onEndReachedThreshold={0.8}
        refreshing={pulling}
        onRefresh={async () => {
          setPulling(true);
          await posts.refetch();
          setPulling(false);
        }}
        ListEmptyComponent={
          posts.isPending ? (
            <CardSkeleton width={tileWidth * 2 + GAP} count={1} ratio={1.6} />
          ) : posts.isError ? (
            <EmptyState title="Couldn’t load your cards" message={friendlyError(posts.error)} actionLabel="Try again" onAction={() => posts.refetch()} />
          ) : (
            <View style={styles.empty}>
              <EmptyState
                title="Your gallery is empty"
                message="Every card you publish lands here."
                actionLabel="Create your first card"
                onAction={() => router.push('/create')}
              />
            </View>
          )
        }
        ListFooterComponent={posts.isFetchingNextPage ? <ActivityIndicator color={theme.textTertiary} style={styles.more} /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  topBar: { paddingHorizontal: spacing.lg },
  iconButton: { width: hitTarget, height: hitTarget, alignItems: 'flex-end', justifyContent: 'center' },
  profile: { paddingBottom: spacing.xl },
  // Masonry places items in whichever column is shorter, so tiles pad symmetrically.
  list: { paddingHorizontal: GUTTER - GAP / 2, paddingBottom: spacing.xxl },
  tile: { paddingHorizontal: GAP / 2, marginBottom: GAP },
  empty: { paddingTop: spacing.xxl },
  more: { paddingVertical: spacing.lg },
});
