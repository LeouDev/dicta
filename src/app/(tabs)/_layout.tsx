import { Tabs } from 'expo-router/tabs';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { useMessagesRealtime } from '@/hooks/use-messages';
import { useNotificationsRealtime } from '@/hooks/use-notifications';
import { useExpiredStoryCleanup } from '@/hooks/use-stories';

export default function TabsLayout() {
  useNotificationsRealtime();
  useMessagesRealtime();
  useExpiredStoryCleanup();
  return (
    <Tabs tabBar={(props) => <BottomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
