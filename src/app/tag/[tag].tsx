import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { PostGrid } from '@/features/feed/post-grid';
import { useTagPosts } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';

export default function TagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: `#${tag}` }} />
      <PostGrid query={useTagPosts(tag)} empty={<EmptyState title={`No quotes with #${tag} yet`} message="Use it in your next card." />} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
