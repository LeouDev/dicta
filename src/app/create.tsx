import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { DesignStep } from '@/features/composer/design-step';
import { clearDraftPhotos } from '@/features/composer/photo';
import { useComposer } from '@/features/composer/store';
import { validatePost } from '@/features/composer/validate';
import { WriteStep } from '@/features/composer/write-step';
import type { CardAuthor } from '@/features/quote-card/types';
import { openShare } from '@/features/share/share-sheet';
import { useMyProfile } from '@/hooks/use-my-profile';
import { showActions } from '@/lib/action-sheet';
import { queryClient } from '@/lib/query-client';
import { friendlyError } from '@/services/errors';
import { publishPost } from '@/services/posts';
import { selectUserId, useAuth } from '@/store/auth';
import { profileToAuthor } from '@/types/models';

const FALLBACK_AUTHOR: CardAuthor = { displayName: 'You', username: 'you', avatarUrl: null, isVerified: false };

export default function CreateScreen() {
  const userId = useAuth(selectUserId);
  const { data: profile } = useMyProfile();
  const author = profile ? profileToAuthor(profile) : FALLBACK_AUTHOR;
  const text = useComposer((s) => s.text);
  const design = useComposer((s) => s.design);
  const [step, setStep] = useState<'write' | 'design'>('write');

  const publish = useMutation({
    mutationFn: () => publishPost({ userId, text, design, topic: useComposer.getState().topic }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useComposer.getState().reset();
      clearDraftPhotos();
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.back();
    },
    onError: (e) => Alert.alert('Couldn’t post', friendlyError(e, 'Your card wasn’t published. Please try again.')),
  });

  const post = () => {
    const problem = validatePost(text, design);
    if (problem) return Alert.alert('Almost there', problem);
    publish.mutate();
  };

  // The draft is saved continuously, so closing never loses work unless asked.
  const close = () => {
    if (!text.trim()) return router.back();
    showActions([
      { label: 'Keep draft', onPress: () => router.back() },
      {
        label: 'Discard draft',
        destructive: true,
        onPress: () => {
          useComposer.getState().reset();
          clearDraftPhotos();
          router.back();
        },
      },
    ]);
  };

  return step === 'write' ? (
    <WriteStep
      onClose={close}
      onNext={() => setStep('design')}
    />
  ) : (
    <DesignStep
      author={author}
      onEditText={() => setStep('write')}
      onShare={() => openShare({ text, design, author })}
      onPost={post}
      posting={publish.isPending}
    />
  );
}
