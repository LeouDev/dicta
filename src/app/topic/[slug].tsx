import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { PostGrid } from '@/features/feed/post-grid';
import { useTopics } from '@/hooks/use-discover';
import { useTopicPosts } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';

export default function TopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const theme = useTheme();
  const label = useTopics().data?.find((t) => t.slug === slug)?.label ?? '';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: label }} />
      <PostGrid query={useTopicPosts(slug)} empty={<EmptyState title={`Nothing in ${label || 'this topic'} yet`} message="Write the first one." />} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
