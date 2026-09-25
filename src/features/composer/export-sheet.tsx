import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { EXPORT_OPTIONS, EXPORT_WIDTH, exportCardImage, resolveExportFormat, type ExportFormat } from '@/features/quote-card/export';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { CARD_FORMATS, type CardAuthor, type QuoteDesign } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';
import { friendlyError } from '@/services/errors';

import { ToggleRow } from './controls';

interface ExportSheetProps {
  visible: boolean;
  onClose: () => void;
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
}

const PREVIEW_HEIGHT = 380;

/** Pick a format, preview exactly what will be exported, and hand it to the iOS share sheet. */
export function ExportSheet({ visible, onClose, text, design, author }: ExportSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [format, setFormat] = useState<ExportFormat>('story');
  const [watermark, setWatermark] = useState(false);
  const target = resolveExportFormat(format, design);
  const previewWidth = Math.min(screenWidth - spacing.xl * 2, PREVIEW_HEIGHT * CARD_FORMATS[target].ratio);

  const share = useMutation({
    mutationFn: async () => {
      const uri = await exportCardImage({ text, design, author, format, watermark });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your card' });
    },
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.header}>
          <Text variant="headline">Share image</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <Text variant="bodyStrong" color="accent">
              Done
            </Text>
          </Pressable>
        </View>

        <View style={styles.preview}>
          <QuoteCard text={text} design={design} author={author} width={previewWidth} format={target} watermark={watermark} radius={radius.sm} />
          <Text variant="caption" color="textTertiary" style={styles.size}>
            {EXPORT_WIDTH} × {Math.round(EXPORT_WIDTH / CARD_FORMATS[target].ratio)} PNG
          </Text>
        </View>

        <View style={styles.formats} accessibilityRole="radiogroup">
          {EXPORT_OPTIONS.map((option) => {
            const selected = option.format === format;
            const ratio = CARD_FORMATS[resolveExportFormat(option.format, design)].ratio;
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
                style={[styles.format, { backgroundColor: theme.surface, borderColor: selected ? theme.text : 'transparent' }]}>
                <View style={styles.silhouetteBox}>
                  <View
                    style={[
                      styles.silhouette,
                      { width: 30 * Math.min(1, ratio / 0.8), aspectRatio: ratio, borderColor: selected ? theme.text : theme.textTertiary },
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

        {share.error && (
          <Text variant="caption" color="danger" align="center">
            {friendlyError(share.error, 'Couldn’t create the image. Please try again.')}
          </Text>
        )}
        <Button label="Share" icon="share" onPress={() => share.mutate()} loading={share.isPending} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
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
  silhouetteBox: { height: 44, justifyContent: 'center', marginBottom: spacing.xs },
  silhouette: { borderWidth: 1.5, borderRadius: 4 },
});
