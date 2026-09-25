import * as Haptics from 'expo-haptics';
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { QuoteCard } from '@/features/quote-card/quote-card';
import { TEMPLATES, createDesign } from '@/features/quote-card/templates';
import { TEMPLATE_IDS, type CardAuthor, type TemplateId } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

import { useComposer } from './store';

const THUMB_WIDTH = 84;

/** Live thumbnails: every template renders the person's own words (or its sample before they write). */
export function TemplatePicker({ author }: { author: CardAuthor }) {
  const text = useComposer((s) => s.text.trim());
  const current = useComposer((s) => s.design.template);
  const canvas = useComposer((s) => s.design.canvas);
  const photo = useComposer((s) => (s.design.background.type === 'image' ? s.design.background.image : null));
  const chooseTemplate = useComposer((s) => s.chooseTemplate);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {TEMPLATE_IDS.map((id) => (
        <TemplateThumb
          key={id}
          id={id}
          text={text || TEMPLATES[id].sample}
          author={author}
          canvas={canvas}
          photo={photo}
          selected={id === current}
          onPress={() => {
            Haptics.selectionAsync();
            chooseTemplate(id);
          }}
        />
      ))}
    </ScrollView>
  );
}

interface ThumbProps {
  id: TemplateId;
  text: string;
  author: CardAuthor;
  canvas: ReturnType<typeof createDesign>['canvas'];
  photo: string | null;
  selected: boolean;
  onPress: () => void;
}

const TemplateThumb = memo(function TemplateThumb({ id, text, author, canvas, photo, selected, onPress }: ThumbProps) {
  const theme = useTheme();
  const design = useMemo(() => {
    const d = { ...createDesign(id), canvas };
    return d.background.type === 'image' && photo ? { ...d, background: { ...d.background, image: photo } } : d;
  }, [id, canvas, photo]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${TEMPLATES[id].label} template. ${TEMPLATES[id].description}`}
      style={styles.thumb}>
      <View style={[styles.ring, { borderColor: selected ? theme.text : 'transparent' }]}>
        <QuoteCard text={text} design={design} author={author} width={THUMB_WIDTH} radius={radius.sm} />
      </View>
      <Text variant="caption" color={selected ? 'text' : 'textSecondary'}>
        {TEMPLATES[id].label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { gap: spacing.sm + 4, paddingVertical: spacing.sm, paddingRight: spacing.lg },
  thumb: { alignItems: 'center', gap: spacing.xs + 2 },
  ring: { padding: 3, borderWidth: 2, borderRadius: radius.sm + 5 },
});
