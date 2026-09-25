import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { registerDevice } from '@/services/push';
import { selectUserId, useAuth } from '@/store/auth';

// Banners show while Dicta is open too; Activity updates live underneath.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Opens what a push is about, as Activity does: the follower, or the post (then its comments). */
function open(response: Notifications.NotificationResponse) {
  const { url, then } = response.notification.request.content.data ?? {};
  if (typeof url !== 'string' || !url.startsWith('/')) return;
  router.push(url as Href);
  if (typeof then === 'string' && then.startsWith('/')) router.push(then as Href);
}

/**
 * Keeps this device registered for the signed-in person's pushes (tokens can
 * change between launches), and opens tapped pushes once the signed-in
 * screens exist (`ready`), including the one that launched the app.
 */
export function usePushNotifications(ready: boolean) {
  const userId = useAuth(selectUserId);

  useEffect(() => {
    if (userId) registerDevice().catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      open(launch);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready]);
}
