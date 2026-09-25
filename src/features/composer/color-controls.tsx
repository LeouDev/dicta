import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { fontFamily, radius, spacing } from '@/constants/tokens';
import { PALETTES, TEXT_COLORS, type Palette } from '@/features/quote-card/palettes';
import { useTheme } from '@/hooks/use-theme';

import { ColorPickerSheet } from './color-picker-sheet';
import { SectionLabel, SwatchRow } from './controls';
import { useComposer } from './store';

type Target = 'textColor' | 'metaColor';

export function ColorControls() {
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const [picking, setPicking] = useState<Target | null>(null);
  const bg = design.background;

  const applyPalette = (p: Palette) =>
    update({ background: { type: 'solid', color: p.background }, textColor: p.text, metaColor: p.meta });

  return (
    <>
      <SectionLabel>Palettes</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palettes}>
        {PALETTES.map((p) => (
          <PaletteTile
            key={p.name}
            palette={p}
            selected={bg.type === 'solid' && bg.color === p.background && design.textColor === p.text}
            onPress={() => applyPalette(p)}
          />
        ))}
      </ScrollView>

      <SectionLabel>Text</SectionLabel>
      <SwatchRow colors={TEXT_COLORS} value={design.textColor} onChange={(textColor) => update({ textColor })} onCustom={() => setPicking('textColor')} />

      <SectionLabel>Name & signature</SectionLabel>
      <SwatchRow colors={TEXT_COLORS} value={design.metaColor} onChange={(metaColor) => update({ metaColor })} onCustom={() => setPicking('metaColor')} />

      {picking && (
        <ColorPickerSheet
          visible
          title={picking === 'textColor' ? 'Text color' : 'Name & signature color'}
          initial={design[picking].slice(0, 7)}
          onChange={(hex) => update({ [picking]: hex })}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}

function PaletteTile({ palette, selected, onPress }: { palette: Palette; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${palette.name} palette`}
      style={styles.paletteItem}>
      <View style={[styles.paletteRing, { borderColor: selected ? theme.text : 'transparent' }]}>
        <View style={[styles.paletteTile, { backgroundColor: palette.background, borderColor: theme.hairline }]}>
          <Text allowFontScaling={false} style={[styles.paletteAa, { color: palette.text }]}>
            Aa
          </Text>
        </View>
      </View>
      <Text variant="caption" color={selected ? 'text' : 'textSecondary'}>
        {palette.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  palettes: { gap: spacing.sm, paddingRight: spacing.lg },
  paletteItem: { alignItems: 'center', gap: spacing.xs },
  paletteRing: { padding: 3, borderWidth: 2, borderRadius: radius.md + 5 },
  paletteTile: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteAa: { fontFamily: fontFamily.display, fontSize: 24 },
});
