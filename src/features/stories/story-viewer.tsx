import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/components/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserAvatar } from '@/components/user-avatar';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { CANVASES } from '@/features/quote-card/types';
import { openReport } from '@/features/safety/report-sheet';
import { useNow } from '@/hooks/use-now';
import { useBlock } from '@/hooks/use-safety';
import { useDeleteStory, useMarkStoryViewed, useStories, useStoryViewers } from '@/hooks/use-stories';
import { confirm, showActions } from '@/lib/action-sheet';
import { queryKeys } from '@/lib/query-keys';
import { friendlyError } from '@/services/errors';
import { sendMessage, startConversation } from '@/services/messages';
import { selectUserId, useAuth } from '@/store/auth';
import type { Story, StoryRing } from '@/types/models';
import { timeAgo } from '@/utils/time';

import { openStoryComposer } from './story-tray';

/** How long each story shows before the next. */
const DURATION = 6000;
const TOP = 64;
const BOTTOM = 64;
const INK = '#FFFFFF';

/** The /story/[userId] screen: someone's live stories, one after another, then the next person's. */
export function StoryViewerScreen() {
  const { userId: authorId } = useLocalSearchParams<{ userId: string }>();
  const stories = useStories(authorId);
  const close = () => router.back();

  if (!stories.data?.length) {
    return (
      <View style={[styles.root, styles.center]}>
        {stories.isPending ? (
          <ActivityIndicator color={INK} />
        ) : stories.isError ? (
          <EmptyState title="Couldn’t load this story" message={friendlyError(stories.error)} actionLabel="Close" onAction={close} />
        ) : (
          <EmptyState title="No story right now" message="Stories last 24 hours." actionLabel="Close" onAction={close} />
        )}
      </View>
    );
  }
  // Mounted once the stories are here, so it starts at the first you haven't seen and stays put as they're marked seen.
  return <StoryPlayer key={authorId} authorId={authorId} list={stories.data} />;
}

function StoryPlayer({ authorId, list }: { authorId: string; list: Story[] }) {
  const me = useAuth(selectUserId);
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const markViewed = useMarkStoryViewed();
  const remove = useDeleteStory();
  const block = useBlock();
  const now = useNow();
  const mine = authorId === me;

  const [picked, setPicked] = useState(() => Math.max(0, list.findIndex((s) => !s.viewedByMe)));
  // Deleting one of yours can shorten the list under you.
  const index = Math.min(picked, list.length - 1);
  const setIndex = setPicked;
  const story = list[index];

  // Paused while you hold the screen, type a reply, or look at viewers or a menu.
  const [holding, setHolding] = useState(false);
  const [typing, setTyping] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const paused = holding || typing || viewersOpen || menuOpen;

  const close = () => router.back();
  /** The person after (or before) this one in the tray, to carry on with. */
  const neighbor = (step: 1 | -1) => {
    const tray = client.getQueryData<StoryRing[]>(queryKeys.storyTray(me)) ?? [];
    const at = tray.findIndex((ring) => ring.author.id === authorId);
    return at >= 0 ? tray[at + step]?.author.id : undefined;
  };
  const next = () => {
    if (index !== null && index < list.length - 1) return setIndex(index + 1);
    const after = neighbor(1);
    if (after && !mine) router.replace(`/story/${after}`);
    else close();
  };
  const previous = () => {
    if (index !== null && index > 0) return setIndex(index - 1);
    const before = neighbor(-1);
    if (before && !mine) router.replace(`/story/${before}`);
    else setReplays((n) => n + 1);
  };

  // Each story fills its bar, then moves on; pausing holds the bar where it is.
  const progress = useSharedValue(0);
  // Back on the first story replays it.
  const [replays, setReplays] = useState(0);
  const playing = useRef('');
  useEffect(() => {
    if (!story) return;
    // A new story (or a replay) starts from 0 with the whole duration. Its bar can't be read for that:
    // setting it reaches the UI thread later, and reading it now would still see the last story's 1.
    const take = `${story.id}:${replays}`;
    const fresh = playing.current !== take;
    playing.current = take;
    cancelAnimation(progress);
    if (fresh) progress.set(0);
    if (paused) return;
    const from = fresh ? 0 : progress.get();
    progress.set(
      withTiming(1, { duration: (1 - from) * DURATION, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(next)();
      }),
    );
    // `next` reads this story's index; re-run when the story, a replay or pause changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, replays, paused]);

  // Seen once shown.
  useEffect(() => {
    if (story && !story.viewedByMe && !mine) markViewed.mutate(story);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const swipeDown = Gesture.Pan()
    .activeOffsetY(24)
    .failOffsetX([-24, 24])
    .onEnd((e) => {
      if (e.translationY > 90) runOnJS(close)();
    });

  // Paused from the menu opening until it's cancelled or what it opened is done.
  const openMenu = () => {
    if (!story) return;
    setMenuOpen(true);
    const done = () => setMenuOpen(false);
    const author = list[0];
    if (mine) {
      showActions(
        [
          { label: 'Add another story', onPress: () => (close(), openStoryComposer()) },
          {
            label: 'Delete this story',
            destructive: true,
            onPress: () =>
              confirm(
                'Delete this story?',
                'It disappears for everyone now, before its 24 hours are up.',
                'Delete',
                () =>
                  remove.mutate(story, {
                    onSuccess: () => (list.length <= 1 ? close() : setIndex(Math.min(index ?? 0, list.length - 2))),
                    onSettled: done,
                  }),
                done,
              ),
          },
        ],
        undefined,
        done,
      );
    } else if (author) {
      showActions(
        [
          { label: 'Report story', onPress: () => (close(), openReport({ kind: 'story', id: story.id, userId: author.authorId, label: 'this story' })) },
          {
            label: `Block @${author.author.username}`,
            destructive: true,
            onPress: () =>
              confirm(
                `Block @${author.author.username}?`,
                'You won’t see each other’s posts or stories, and they can’t message you.',
                'Block',
                () => {
                  block.mutate({ targetId: author.authorId, username: author.author.username, blocked: true });
                  close();
                },
                done,
              ),
          },
        ],
        undefined,
        done,
      );
    } else done();
  };

  const ratio = CANVASES[story.design.canvas];
  const cardWidth = Math.min(width - spacing.sm * 2, (height - insets.top - insets.bottom - TOP - BOTTOM) * ratio);

  return (
    <GestureDetector gesture={swipeDown}>
      <KeyboardAvoidingView behavior="padding" style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.top}>
          <View style={styles.bars}>
            {list.map((s, i) => (
              <Bar key={s.id} state={i < (index ?? 0) ? 'done' : i === index ? 'playing' : 'waiting'} progress={progress} />
            ))}
          </View>
          <View style={styles.header}>
            <AuthorLine story={story} now={now} />
            <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel="More options" hitSlop={8} style={styles.icon}>
              <Icon name="more" size={22} color={INK} />
            </Pressable>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.icon}>
              <Icon name="close" size={22} color={INK} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={styles.stage}
          onPress={(e) => (e.nativeEvent.locationX < width * 0.3 ? previous() : next())}
          onLongPress={() => setHolding(true)}
          delayLongPress={180}
          onPressOut={() => setHolding(false)}
          accessibilityRole="adjustable"
          accessibilityLabel={`Story ${(index ?? 0) + 1} of ${list.length}`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? next() : previous())}>
          <QuoteCard text={story.text} design={story.design} author={story.author} width={cardWidth} radius={radius.md} />
        </Pressable>

        <View style={styles.bottom}>
          {mine ? (
            <Pressable onPress={() => setViewersOpen(true)} accessibilityRole="button" style={styles.seen}>
              <Icon name="eye" size={18} color={INK} />
              <ViewerCount storyId={story.id} />
            </Pressable>
          ) : (
            <Reply story={story} authorId={authorId} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
          )}
        </View>

        {viewersOpen && <Viewers storyId={story.id} onClose={() => setViewersOpen(false)} />}
      </KeyboardAvoidingView>
    </GestureDetector>
  );
}

function AuthorLine({ story, now }: { story: Story; now: ReturnType<typeof useNow> }) {
  const { author } = story;
  return (
    <Pressable
      onPress={() => (router.back(), router.push(`/user/${author.username}`))}
      accessibilityRole="link"
      accessibilityLabel={`${author.displayName}, ${timeAgo(story.createdAt, now)}. Opens their profile`}
      style={styles.author}>
      <UserAvatar uri={author.avatarUrl} name={author.displayName} size={32} />
      <Text variant="subhead" style={styles.authorName} numberOfLines={1}>
        {author.displayName}
      </Text>
      <Text variant="caption" style={styles.when}>
        {timeAgo(story.createdAt, now)}
      </Text>
    </Pressable>
  );
}

function Bar({ state, progress }: { state: 'done' | 'playing' | 'waiting'; progress: { get: () => number } }) {
  const fill = useAnimatedStyle(() => ({ width: `${(state === 'done' ? 1 : state === 'playing' ? progress.get() : 0) * 100}%` }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

function ViewerCount({ storyId }: { storyId: string }) {
  const viewers = useStoryViewers(storyId);
  const count = viewers.data?.length ?? 0;
  return (
    <Text variant="subhead" style={styles.seenText}>
      {viewers.isPending ? 'Seen by…' : count === 0 ? 'No views yet' : `Seen by ${count}`}
    </Text>
  );
}

/** Who saw your story, over it. */
function Viewers({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const viewers = useStoryViewers(storyId);
  const now = useNow();
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text variant="headline" style={styles.ink}>
          Viewers
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close viewers" hitSlop={8}>
          <Icon name="close" size={20} color={INK} />
        </Pressable>
      </View>
      <FlatList
        data={viewers.data ?? []}
        keyExtractor={(v) => v.viewer.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => (router.back(), router.push(`/user/${item.viewer.username}`))}
            accessibilityRole="link"
            style={styles.viewer}>
            <UserAvatar uri={item.viewer.avatarUrl} name={item.viewer.displayName} size={36} />
            <Text variant="callout" style={[styles.ink, styles.viewerName]} numberOfLines={1}>
              {item.viewer.displayName}
            </Text>
            <Text variant="caption" style={styles.when}>
              {timeAgo(item.viewedAt, now)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          viewers.isPending ? (
            <ActivityIndicator color={INK} style={styles.loading} />
          ) : (
            <Text variant="callout" style={[styles.when, styles.empty]}>
              No one has seen it yet.
            </Text>
          )
        }
      />
    </View>
  );
}

/** "Reply to …": sends the story's author a message about it. */
function Reply({ story, authorId, onFocus, onBlur }: { story: Story; authorId: string; onFocus: () => void; onBlur: () => void }) {
  const me = useAuth(selectUserId);
  const client = useQueryClient();
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const send = useMutation({
    mutationFn: async () => {
      const conversationId = await startConversation(authorId);
      return sendMessage({ conversationId, senderId: me!, body: text, storyId: story.id });
    },
    onSuccess: () => {
      setText('');
      input.current?.blur();
      client.invalidateQueries({ queryKey: queryKeys.conversations(me) });
      toast('Sent');
    },
    onError: (error) => toast(friendlyError(error, 'Couldn’t send your reply.')),
  });
  const ready = text.trim().length > 0 && !send.isPending;
  return (
    <View style={styles.reply}>
      <TextInput
        ref={input}
        value={text}
        onChangeText={setText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Send a message"
        placeholderTextColor="rgba(255, 255, 255, 0.6)"
        selectionColor={INK}
        maxLength={1000}
        returnKeyType="send"
        onSubmitEditing={() => ready && send.mutate()}
        accessibilityLabel="Reply to this story"
        style={styles.replyInput}
      />
      {ready && (
        <Pressable onPress={() => send.mutate()} accessibilityRole="button" accessibilityLabel="Send" hitSlop={8} style={styles.icon}>
          <Icon name="send" size={20} color={INK} weight="semibold" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { height: TOP, paddingHorizontal: spacing.sm, justifyContent: 'center', gap: spacing.sm },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.35)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: INK },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorName: { color: INK, fontWeight: '600', flexShrink: 1 },
  when: { color: 'rgba(255, 255, 255, 0.7)' },
  icon: { width: hitTarget - 8, height: hitTarget - 8, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { height: BOTTOM, justifyContent: 'center', paddingHorizontal: spacing.md },
  seen: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingVertical: spacing.sm },
  seenText: { color: INK, fontWeight: '600' },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  replyInput: { flex: 1, color: INK, fontSize: 16, paddingVertical: spacing.sm },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundColor: 'rgba(22, 20, 18, 0.97)',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  ink: { color: INK },
  viewer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  viewerName: { flex: 1 },
  loading: { paddingVertical: spacing.lg },
  empty: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
});
