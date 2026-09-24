import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function ActivityScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Activity" />
      <EmptyState title="No activity yet" message="When people follow you, love or comment on your cards, you’ll see it here." />
    </Screen>
  );
}
