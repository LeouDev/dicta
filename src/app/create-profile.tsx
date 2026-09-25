import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';
import { ProfileForm, isUsernameTaken, type ProfileFormValues } from '@/features/profile/profile-form';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { signOut } from '@/services/auth';
import { friendlyError } from '@/services/errors';
import { createProfile } from '@/services/profiles';
import { useAuth } from '@/store/auth';
import { suggestUsername } from '@/utils/validation';

export default function CreateProfileScreen() {
  const user = useAuth((s) => s.session?.user);
  const metadataName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      createProfile({ userId: user!.id, username: values.username, displayName: values.displayName, bio: values.bio, avatarLocalUri: values.avatar ?? null }),
    onMutate: () => setError(null),
    onSuccess: (profile) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The root guard sees the profile and moves to the app.
      queryClient.setQueryData(queryKeys.profile(profile.id), profile);
    },
    onError: (e) => setError(isUsernameTaken(e) ? 'Someone just claimed that username. Try another.' : friendlyError(e, 'We couldn’t create your profile. Please try again.')),
  });

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header">
          Make it yours
        </Text>
        <Text variant="callout" color="textSecondary">
          This is how you’ll appear on every card you share.
        </Text>
      </View>
      <ProfileForm
        initial={{ displayName: metadataName, username: suggestUsername(metadataName || user?.email || ''), bio: '', avatarUrl: null }}
        submitLabel="Continue"
        submitting={create.isPending}
        error={error}
        onSubmit={(values) => create.mutate(values)}
        footer={<Button label="Use a different account" variant="ghost" size="md" onPress={() => signOut().catch(() => {})} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.lg },
});
