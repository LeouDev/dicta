import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { toast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { ToggleRow } from '@/features/composer/controls';
import { EXPORT_OPTIONS, EXPORT_WIDTH, exportCardImage, renderStoryImages } from '@/features/quote-card/export';
import { formatRatio } from '@/features/quote-card/geometry';
import { QuoteCard } from '@/features/quote-card/quote-card';
import type { CardAuthor, Format, QuoteDesign } from '@/features/quote-card/types';
import { useRecordShare } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';
import {
  PermissionError,
  canShareToStories,
  copyPostLink,
  saveImageToPhotos,
  sharePostTo,
  shareImage,
  shareToStories,
  type PostApp,
  type StoriesApp,
} from '@/services/share';

import { BrandGlyph } from './brand-glyph';

export interface ShareTarget {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  /** Set for published posts: enables Copy link and counts shares. */
  postId?: string;
}

// The target lives in a store (designs are too big for URL params); the /share route presents it.
const useShareStore = create<{ target: ShareTarget | null }>()(() => ({
  target: null,
}));
export function openShare(target: ShareTarget) {
  useShareStore.setState({ target });
  router.push('/share');
}

/** The /share modal screen. */
export function ShareScreen() {
  const target = useShareStore((s) => s.target);
  // Opened without anything to share (e.g. a stray link): just close.
  useEffect(() => {
    if (!target) router.back();
  }, [target]);
  return target ? <ShareSheet target={target} onClose={() => router.back()} /> : null;
}

const PREVIEW_HEIGHT = 360;

const STORIES: Record<StoriesApp, string> = { instagram: 'Instagram', facebook: 'Facebook' };
const POSTS: Record<PostApp, string> = { threads: 'Threads', x: 'X' };

/** The Stories apps on this phone. */
function useStoriesApps() {
  const [apps, setApps] = useState<StoriesApp[]>([]);
  useEffect(() => {
    const all = Object.keys(STORIES) as StoriesApp[];
    Promise.all(all.map(canShareToStories)).then((installed) => setApps(all.filter((_, i) => installed[i])));
  }, []);
  return apps;
}

/** Pick a format, preview exactly what will be exported, then save, share or copy a link. */
function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const { text, design, author, postId } = target;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [format, setFormat] = useState<Format>('story');
  const [watermark, setWatermark] = useState(false);
  const recordShare = useRecordShare(postId ?? null);
  const storiesApps = useStoriesApps();
  // The preview takes the height left over by the controls, up to PREVIEW_HEIGHT.
  const [previewHeight, setPreviewHeight] = useState(PREVIEW_HEIGHT);
  const ratio = formatRatio(format, design.canvas);
  const previewWidth = Math.min(screenWidth - spacing.xl * 2, previewHeight * ratio);
  const counted = () => postId && recordShare.mutate();

  const render = () => exportCardImage({ text, design, author, format, watermark });
  const onError = (error: unknown) =>
    toast(error instanceof PermissionError ? error.message : friendlyError(error, 'Couldn’t create the image. Please try again.'));

  const share = useMutation({
    mutationFn: async () => shareImage(await render()),
    onSuccess: counted,
    onError,
  });
  const save = useMutation({
    mutationFn: async () => saveImageToPhotos(await render()),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast('Saved to Photos');
      counted();
    },
    onError,
  });
  const story = useMutation({
    mutationFn: async (app: StoriesApp) => shareToStories(app, await renderStoryImages({ text, design, author, watermark }), postId),
    onSuccess: counted,
    onError,
  });
  const post = useMutation({
    mutationFn: (app: PostApp) => sharePostTo(app, postId!, text),
    onSuccess: counted,
    onError,
  });
  const copyLink = useMutation({
    mutationFn: () => copyPostLink(postId!),
    onSuccess: () => {
      Haptics.selectionAsync();
      toast('Link copied');
      counted();
    },
    onError,
  });

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: theme.background,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}>
      <View style={styles.header}>
        <Text variant="headline">Share quote</Text>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text variant="bodyStrong" color="accent">
            Done
          </Text>
        </Pressable>
      </View>

      <View style={styles.preview} onLayout={(e) => setPreviewHeight(Math.min(PREVIEW_HEIGHT, e.nativeEvent.layout.height))}>
        <QuoteCard
          text={text}
          design={design}
          author={author}
          width={previewWidth}
          format={format}
          watermark={watermark}
          radius={radius.sm}
        />
      </View>
      <Text variant="caption" color="textTertiary" align="center" style={styles.size}>
        {EXPORT_WIDTH} × {Math.round(EXPORT_WIDTH / ratio)} PNG
      </Text>

      <View style={styles.formats} accessibilityRole="radiogroup">
        {EXPORT_OPTIONS.map((option) => {
          const selected = option.format === format;
          const tileRatio = formatRatio(option.format, design.canvas);
          return (
            <Pressable
              key={option.format}
              onPress={() => {
                Haptics.selectionAsync();
                setFormat(option.format);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}, ${option.detail}`}
              style={[
                styles.format,
                {
                  backgroundColor: theme.surface,
                  borderColor: selected ? theme.text : 'transparent',
                },
              ]}>
              <View style={styles.silhouetteBox}>
                <View
                  style={[
                    styles.silhouette,
                    {
                      width: 30 * Math.min(1, tileRatio / 0.8),
                      aspectRatio: tileRatio,
                      borderColor: selected ? theme.text : theme.textTertiary,
                    },
                  ]}
                />
              </View>
              <Text variant="subhead">{option.label}</Text>
              <Text variant="caption" color="textTertiary" numberOfLines={1}>
                {option.detail}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ToggleRow label="Add a small Dicta mark" value={watermark} onChange={setWatermark} />

      {/* Stories get the card as designed, as a sticker; the format above is for images. */}
      <View style={styles.targets}>
        {storiesApps.map((app) => (
          <Target
            key={app}
            label={STORIES[app]}
            accessibilityLabel={`Share to your ${STORIES[app]} story`}
            busy={story.isPending && story.variables === app}
            onPress={() => story.mutate(app)}>
            <BrandGlyph brand={app} size={22} color={theme.text} />
          </Target>
        ))}
        {postId &&
          (Object.keys(POSTS) as PostApp[]).map((app) => (
            <Target key={app} label={POSTS[app]} accessibilityLabel={`Post on ${POSTS[app]}`} onPress={() => post.mutate(app)}>
              <BrandGlyph brand={app} size={22} color={theme.text} />
            </Target>
          ))}
        <Target label="Save" accessibilityLabel="Save image" busy={save.isPending} onPress={() => save.mutate()}>
          <Icon name="download" size={24} color={theme.text} />
        </Target>
        {postId && (
          <Target label="Copy link" busy={copyLink.isPending} onPress={() => copyLink.mutate()}>
            <Icon name="link" size={24} color={theme.text} />
          </Target>
        )}
      </View>
      <Button label="Share…" icon="share" onPress={() => share.mutate()} loading={share.isPending} />
    </View>
  );
}

interface TargetProps {
  label: string;
  accessibilityLabel?: string;
  busy?: boolean;
  onPress: () => void;
  children: ReactNode;
}

function Target({ label, accessibilityLabel = label, busy = false, onPress, children }: TargetProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy }}
      style={[styles.target, { opacity: busy ? 0.5 : 1 }]}>
      <View style={[styles.targetIcon, { backgroundColor: theme.surface }]}>{children}</View>
      <Text variant="caption" color="textSecondary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  size: { fontVariant: ['tabular-nums'] },
  formats: { flexDirection: 'row', gap: spacing.sm },
  format: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: 2,
  },
  silhouetteBox: {
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  silhouette: { borderWidth: 1.5, borderRadius: 4 },
  targets: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  target: { flex: 1, maxWidth: 76, alignItems: 'center', gap: spacing.xs + 2 },
  targetIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
