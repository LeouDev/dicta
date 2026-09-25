import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { toast } from '@/components/toast';
import { Screen } from '@/components/ui/screen';
import { ProfileForm, isUsernameTaken, type ProfileFormValues } from '@/features/profile/profile-form';
import { useMyProfile } from '@/hooks/use-my-profile';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { updateProfile } from '@/services/profiles';

export default function EditProfileScreen() {
  const client = useQueryClient();
  const { data: me } = useMyProfile();
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (values: ProfileFormValues) => updateProfile(me!, values),
    onMutate: () => setError(null),
    onSuccess: (profile) => {
      client.setQueryData(queryKeys.profile(profile.id), profile);
      // Your name and photo are embedded in every cached card, comment and notification.
      for (const key of [['posts'], ['post'], ['comments'], ['replies'], ['profile', 'username']]) client.invalidateQueries({ queryKey: key });
      toast('Profile updated');
      router.back();
    },
    onError: (e) => setError(isUsernameTaken(e) ? 'Someone just claimed that username. Try another.' : friendlyError(e, 'We couldn’t save your profile.')),
  });

  if (!me) return null;
  return (
    <Screen scroll edges={['bottom']} contentStyle={{ paddingTop: 16 }}>
      <ProfileForm
        initial={{ displayName: me.display_name, username: me.username, bio: me.bio, avatarUrl: me.avatar_url }}
        currentUsername={me.username}
        submitLabel="Save"
        submitting={save.isPending}
        error={error}
        onSubmit={(values) => save.mutate(values)}
      />
    </Screen>
  );
}
