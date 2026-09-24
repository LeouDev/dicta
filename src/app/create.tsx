import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

// Phase 3 replaces this with the quote card editor (write → design → publish).
export default function CreateScreen() {
  return (
    <Screen edges={['bottom']}>
      <View style={styles.top}>
        <BackButton icon="close" />
      </View>
      <EmptyState title="What’s on your mind?" message="The card editor is being built next." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: 12 },
});
