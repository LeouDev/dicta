import { StyleSheet } from 'react-native';

import { Text } from '@/components/ui/text';
import { FONT_KEYS, FONT_LIBRARY, availableWeights, hasItalic, resolveFace, type FontWeight } from '@/constants/fonts';
import { DESIGN_LIMITS } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

import { Chip, ChipScroller, SectionLabel, Segmented, SliderRow, ToggleRow } from './controls';
import { useComposer } from './store';

const WEIGHT_LABELS: Record<FontWeight, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Heavy',
  900: 'Black',
};

const CATEGORY_LABELS = { serif: 'Serif', sans: 'Sans', mono: 'Mono', script: 'Script' } as const;

export function FontPicker() {
  const theme = useTheme();
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const weights = availableWeights(design.font);

  return (
    <>
      <SectionLabel>Typeface</SectionLabel>
      <ChipScroller>
        {FONT_KEYS.map((key) => {
          const font = FONT_LIBRARY[key];
          return (
            <Chip
              key={key}
              label={`${font.label} · ${CATEGORY_LABELS[font.category]}`}
              selected={design.font === key}
              onPress={() => update({ font: key, weight: font.defaultWeight, italic: design.italic && hasItalic(key) })}
              preview={
                <Text allowFontScaling={false} style={[styles.aa, { fontFamily: resolveFace(key, font.defaultWeight), color: theme.text }]}>
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
            value={String(design.weight)}
            onChange={(w) => update({ weight: Number(w) as FontWeight })}
          />
        </>
      )}
      {hasItalic(design.font) && <ToggleRow label="Italic" value={design.italic} onChange={(italic) => update({ italic })} />}
      <ToggleRow
        label="All caps"
        value={design.textTransform === 'uppercase'}
        onChange={(caps) => update({ textTransform: caps ? 'uppercase' : 'none' })}
      />

      <SliderRow
        label="Size"
        value={design.size}
        min={DESIGN_LIMITS.size.min}
        max={DESIGN_LIMITS.size.max}
        step={1}
        display={(v) => `up to ${Math.round(v)}`}
        onChange={(size) => update({ size })}
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
