import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { DesignStep } from '@/features/composer/design-step';
import { clearDraftPhotos } from '@/features/composer/photo';
import { useComposer } from '@/features/composer/store';
import { validatePost } from '@/features/composer/validate';
import { WriteStep } from '@/features/composer/write-step';
import type { CardAuthor } from '@/features/quote-card/types';
import { openShare } from '@/features/share/share-sheet';
import { useMyProfile } from '@/hooks/use-my-profile';
import { confirm, showActions } from '@/lib/action-sheet';
import { patchPost } from '@/lib/cache';
import { queryClient } from '@/lib/query-client';
import { friendlyError } from '@/services/errors';
import { publishPost, updatePost } from '@/services/posts';
import { selectUserId, useAuth } from '@/store/auth';
import { profileToAuthor } from '@/types/models';

const FALLBACK_AUTHOR: CardAuthor = { displayName: 'You', username: 'you', avatarUrl: null, isVerified: false };

export default function CreateScreen() {
  const userId = useAuth(selectUserId);
  const { data: profile } = useMyProfile();
  const author = profile ? profileToAuthor(profile) : FALLBACK_AUTHOR;
  const text = useComposer((s) => s.text);
  const design = useComposer((s) => s.design);
  const editing = useComposer((s) => s.editing);
  const [step, setStep] = useState<'write' | 'design'>('write');

  // Leaving an edit, however it ends, brings the draft back (after the screen has gone, so it never shows here).
  useEffect(
    () => () => {
      if (!useComposer.getState().editing) return;
      useComposer.getState().endEdit();
      clearDraftPhotos();
    },
    [],
  );

  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    router.back();
  };

  const publish = useMutation({
    mutationFn: () => publishPost({ userId, text, design, topic: useComposer.getState().topic, author }),
    onSuccess: () => {
      useComposer.getState().reset();
      clearDraftPhotos();
      done();
    },
    onError: (e) => Alert.alert('Couldn’t post', friendlyError(e, 'Your card wasn’t published. Please try again.')),
  });

  const save = useMutation({
    mutationFn: (edit: NonNullable<typeof editing>) =>
      updatePost({ postId: edit.postId, previousPhoto: edit.photoPath, userId, text, design, topic: useComposer.getState().topic, author }),
    onSuccess: (changes, edit) => {
      patchPost(queryClient, edit.postId, (p) => ({ ...p, ...changes }));
      done();
    },
    onError: (e) => Alert.alert('Couldn’t save', friendlyError(e, 'Your changes weren’t saved. Please try again.')),
  });

  const post = () => {
    const problem = validatePost(text, design);
    if (problem) return Alert.alert('Almost there', problem);
    if (editing) save.mutate(editing);
    else publish.mutate();
  };

  // The draft is saved continuously, so closing never loses work unless asked.
  const close = () => {
    if (editing) return confirm('Discard your changes?', 'The post stays as it was.', 'Discard', () => router.back());
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
      posting={publish.isPending || save.isPending}
      editing={editing !== null}
    />
  );
}
