import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function DiscoverScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Discover" />
      <EmptyState title="Nothing trending yet" message="Trending cards, creators and topics will gather here." />
    </Screen>
  );
}
