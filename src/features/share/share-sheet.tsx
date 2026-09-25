import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { toast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { ToggleRow } from '@/features/composer/controls';
import { EXPORT_OPTIONS, EXPORT_WIDTH, exportCardImage } from '@/features/quote-card/export';
import { formatRatio } from '@/features/quote-card/geometry';
import { QuoteCard } from '@/features/quote-card/quote-card';
import type { CardAuthor, Format, QuoteDesign } from '@/features/quote-card/types';
import { useRecordShare } from '@/hooks/use-social';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';
import { PermissionError, copyPostLink, saveImageToPhotos, shareImage } from '@/services/share';

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

/** Pick a format, preview exactly what will be exported, then save, share or copy a link. */
function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const { text, design, author, postId } = target;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [format, setFormat] = useState<Format>('story');
  const [watermark, setWatermark] = useState(false);
  const recordShare = useRecordShare(postId ?? null);
  const ratio = formatRatio(format, design.canvas);
  const previewWidth = Math.min(screenWidth - spacing.xl * 2, PREVIEW_HEIGHT * ratio);
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

      <View style={styles.preview}>
        <QuoteCard
          text={text}
          design={design}
          author={author}
          width={previewWidth}
          format={format}
          watermark={watermark}
          radius={radius.sm}
        />
        <Text variant="caption" color="textTertiary" style={styles.size}>
          {EXPORT_WIDTH} × {Math.round(EXPORT_WIDTH / ratio)} PNG
        </Text>
      </View>

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

      <View style={styles.quickActions}>
        <QuickAction icon="download" label="Save image" busy={save.isPending} onPress={() => save.mutate()} />
        {postId && <QuickAction icon="link" label="Copy link" busy={copyLink.isPending} onPress={() => copyLink.mutate()} />}
      </View>
      <Button label="Share…" icon="share" onPress={() => share.mutate()} loading={share.isPending} />
    </View>
  );
}

function QuickAction({ icon, label, busy, onPress }: { icon: IconName; label: string; busy: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      style={[styles.quick, { backgroundColor: theme.surface, opacity: busy ? 0.5 : 1 }]}>
      <Icon name={icon} size={18} color={theme.text} />
      <Text variant="subhead">{label}</Text>
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
    gap: spacing.sm,
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
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quick: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    borderRadius: radius.pill,
  },
});
