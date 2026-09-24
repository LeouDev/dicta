import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Wordmark } from '@/components/wordmark';

export default function HomeScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader left={<Wordmark size={20} />} />
      <EmptyState
        title="Your feed is quiet"
        message="Follow people whose words move you, or turn your first thought into a card."
        actionLabel="Write something"
        onAction={() => router.push('/create')}
      />
    </Screen>
  );
}
