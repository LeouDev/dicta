import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { DesignStep } from '@/features/composer/design-step';
import { ExportSheet } from '@/features/composer/export-sheet';
import { clearDraftPhotos } from '@/features/composer/photo';
import { useComposer } from '@/features/composer/store';
import { validatePost } from '@/features/composer/validate';
import { WriteStep } from '@/features/composer/write-step';
import type { CardAuthor } from '@/features/quote-card/types';
import { useMyProfile } from '@/hooks/use-my-profile';
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
  const [sharing, setSharing] = useState(false);

  const publish = useMutation({
    mutationFn: () => publishPost({ userId, text, design }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useComposer.getState().reset();
      clearDraftPhotos();
      queryClient.invalidateQueries({ queryKey: ['feed'] });
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
    if (!text.trim() || Platform.OS !== 'ios') return router.back();
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Keep draft', 'Discard draft', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (index) => {
        if (index === 1) {
          useComposer.getState().reset();
          clearDraftPhotos();
        }
        if (index !== 2) router.back();
      },
    );
  };

  return (
    <>
      {step === 'write' ? (
        <WriteStep
          onClose={close}
          onNext={() => {
            useComposer.getState().autoSize();
            setStep('design');
          }}
        />
      ) : (
        <DesignStep
          author={author}
          onEditText={() => setStep('write')}
          onShare={() => setSharing(true)}
          onPost={post}
          posting={publish.isPending}
        />
      )}
      <ExportSheet visible={sharing} onClose={() => setSharing(false)} text={text} design={design} author={author} />
    </>
  );
}
