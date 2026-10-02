import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';
import { PostGrid } from '@/features/feed/post-grid';
import { useArchivedPosts } from '@/hooks/use-posts';
import { useTheme } from '@/hooks/use-theme';

/** Your archived posts: kept with their likes and comments, seen by you alone. */
export default function ArchiveScreen() {
  const theme = useTheme();
  const archived = useArchivedPosts();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <PostGrid
        query={archived}
        header={
          <Text variant="callout" color="textSecondary" style={styles.note}>
            Only you can see these. Open one and choose ⋯ → Show on profile to bring it back.
          </Text>
        }
        empty={<EmptyState title="Nothing archived" message="Archive a post from its ⋯ menu to take it off your profile without deleting it." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  note: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
