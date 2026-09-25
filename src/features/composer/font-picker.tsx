import { StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { FONT_IDS, FONT_LIBRARY, availableWeights, resolveFontFace, type FontWeight } from '@/constants/fonts';
import { DESIGN_LIMITS } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

import { Chip, ChipScroller, SectionLabel, Segmented, SliderRow } from './controls';
import { useComposer } from './store';

const WEIGHT_LABELS: Record<FontWeight, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Black',
};

const CATEGORY_LABELS = { serif: 'Serif', sans: 'Sans', typewriter: 'Mono', handwritten: 'Script' } as const;

export function FontPicker() {
  const theme = useTheme();
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const setFontSize = useComposer((s) => s.setFontSize);
  const weights = availableWeights(design.fontFamily);

  return (
    <>
      <SectionLabel>Typeface</SectionLabel>
      <ChipScroller>
        {FONT_IDS.map((id) => {
          const font = FONT_LIBRARY[id];
          return (
            <Chip
              key={id}
              label={`${font.label} · ${CATEGORY_LABELS[font.category]}`}
              selected={design.fontFamily === id}
              onPress={() => update({ fontFamily: id, fontWeight: font.defaultWeight })}
              preview={
                <Text allowFontScaling={false} style={[styles.aa, { fontFamily: resolveFontFace(id, font.defaultWeight), color: theme.text }]}>
                  Aa
                </Text>
              }
            />
          );
        })}
      </ChipScroller>

      {weights.length > 1 && (
        <>
          <SectionLabel>Weight</SectionLabel>
          <Segmented
            options={weights.map((w) => ({ value: String(w), label: WEIGHT_LABELS[w] }))}
            value={String(design.fontWeight)}
            onChange={(w) => update({ fontWeight: Number(w) as FontWeight })}
          />
        </>
      )}

      <SliderRow
        label="Size"
        value={design.fontSize}
        min={DESIGN_LIMITS.fontSize.min}
        max={DESIGN_LIMITS.fontSize.max}
        step={1}
        display={(v) => String(Math.round(v))}
        onChange={setFontSize}
      />
      <SliderRow
        label="Letter spacing"
        value={design.letterSpacing}
        min={DESIGN_LIMITS.letterSpacing.min}
        max={DESIGN_LIMITS.letterSpacing.max}
        step={0.005}
        display={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`}
        onChange={(letterSpacing) => update({ letterSpacing })}
      />
      <SliderRow
        label="Line height"
        value={design.lineHeight}
        min={DESIGN_LIMITS.lineHeight.min}
        max={DESIGN_LIMITS.lineHeight.max}
        step={0.01}
        display={(v) => v.toFixed(2)}
        onChange={(lineHeight) => update({ lineHeight })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  aa: { fontSize: 28, lineHeight: 36 },
});
