import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { toast } from '@/components/toast';
import { DesignStep } from '@/features/composer/design-step';
import { clearDraftPhotos } from '@/features/composer/photo';
import { stackOf, useComposer } from '@/features/composer/store';
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
import { publishStory } from '@/services/stories';
import { selectUserId, useAuth } from '@/store/auth';
import { profileToAuthor } from '@/types/models';

const FALLBACK_AUTHOR: CardAuthor = { displayName: 'You', username: 'you', avatarUrl: null, isVerified: false };

/** The composer: a post (one card or a stack), an edit of one, or (/create?mode=story) a 24-hour story. */
export default function CreateScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  // A story sets the draft aside before the first render, so the screen never shows the draft.
  useState(() => {
    if (mode === 'story' && !useComposer.getState().story) useComposer.getState().startStory();
  });
  const userId = useAuth(selectUserId);
  const { data: profile } = useMyProfile();
  const author = profile ? profileToAuthor(profile) : FALLBACK_AUTHOR;
  const text = useComposer((s) => s.text);
  const design = useComposer((s) => s.design);
  const editing = useComposer((s) => s.editing);
  const story = useComposer((s) => s.story);
  const [step, setStep] = useState<'write' | 'design'>('write');

  // Leaving an edit or a story, however it ends, brings the draft back (after the screen has gone, so it never shows here).
  useEffect(
    () => () => {
      const state = useComposer.getState();
      if (state.editing) state.endEdit();
      else if (state.story) state.endStory();
      else return;
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
    mutationFn: () => {
      const state = useComposer.getState();
      const [first, ...cards] = stackOf(state);
      return publishPost({ userId, text: first.text, design: first.design, cards, topic: state.topic, author });
    },
    onSuccess: () => {
      useComposer.getState().reset();
      clearDraftPhotos();
      done();
    },
    onError: (e) => Alert.alert('Couldn’t post', friendlyError(e, 'Your card wasn’t published. Please try again.')),
  });

  const save = useMutation({
    mutationFn: (edit: NonNullable<typeof editing>) => {
      const state = useComposer.getState();
      const [first, ...cards] = stackOf(state);
      return updatePost({ postId: edit.postId, previousPhotos: edit.photoPaths, userId, text: first.text, design: first.design, cards, topic: state.topic, author });
    },
    onSuccess: (changes, edit) => {
      patchPost(queryClient, edit.postId, (p) => ({ ...p, ...changes }));
      done();
    },
    onError: (e) => Alert.alert('Couldn’t save', friendlyError(e, 'Your changes weren’t saved. Please try again.')),
  });

  const share = useMutation({
    mutationFn: () => publishStory({ userId, text, design }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast('Shared to your story for 24 hours');
      router.back();
    },
    onError: (e) => Alert.alert('Couldn’t share', friendlyError(e, 'Your story wasn’t shared. Please try again.')),
  });

  const post = () => {
    const cards = stackOf(useComposer.getState());
    for (const [i, card] of cards.entries()) {
      const problem = validatePost(card.text, card.design);
      if (!problem) continue;
      useComposer.getState().selectCard(i);
      return Alert.alert('Almost there', cards.length > 1 ? `Card ${i + 1}: ${problem}` : problem);
    }
    if (story) share.mutate();
    else if (editing) save.mutate(editing);
    else publish.mutate();
  };

  // The draft is saved continuously, so closing never loses work unless asked.
  const close = () => {
    // Uploading can't be called back: it finishes, then closes the composer itself.
    if (publish.isPending || save.isPending || share.isPending) return toast('Still uploading…');
    if (editing) return confirm('Discard your changes?', 'The post stays as it was.', 'Discard', () => router.back());
    if (story) return text.trim() ? confirm('Discard this story?', 'Your draft post stays as it was.', 'Discard', () => router.back()) : router.back();
    if (!stackOf(useComposer.getState()).some((card) => card.text.trim())) return router.back();
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
    <WriteStep onClose={close} onNext={() => setStep('design')} />
  ) : (
    <DesignStep
      author={author}
      onEditText={() => setStep('write')}
      onShare={() => openShare({ text, design, author })}
      onPost={post}
      posting={publish.isPending || save.isPending || share.isPending}
      editing={editing !== null}
    />
  );
}
