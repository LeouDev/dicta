import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';
import { CANVASES, DESIGN_LIMITS, type Canvas, type TextAlign, type VerticalAlign } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

import { SectionLabel, Segmented, SliderRow } from './controls';
import { useComposer } from './store';

const CANVAS_OPTIONS = (Object.keys(CANVASES) as Canvas[]).map((value) => ({ value, label: value }));

export function LayoutControls() {
  const theme = useTheme();
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const [advanced, setAdvanced] = useState(false);
  const moved = design.textOffset.x !== 0 || design.textOffset.y !== 0 || design.headerOffset.x !== 0 || design.headerOffset.y !== 0;

  return (
    <>
      <View style={styles.hint}>
        <Text variant="caption" color="textSecondary" style={styles.hintText}>
          Drag the text or your name on the card to move them, and pinch to resize them.
        </Text>
        {moved && (
          <Button
            label="Reset"
            variant="secondary"
            size="sm"
            accessibilityHint="Puts the text and your name back where the layout places them"
            onPress={() => update({ textOffset: { x: 0, y: 0 }, headerOffset: { x: 0, y: 0 } })}
          />
        )}
      </View>

      <SectionLabel>Format</SectionLabel>
      <Segmented options={CANVAS_OPTIONS} value={design.canvas} onChange={(canvas) => update({ canvas })} />

      <SectionLabel>Alignment</SectionLabel>
      <View style={styles.pair}>
        <View style={styles.half}>
          <Segmented<TextAlign>
            options={[
              { value: 'left', icon: 'align.left', accessibilityLabel: 'Align left' },
              { value: 'center', icon: 'align.center', accessibilityLabel: 'Align center' },
              { value: 'right', icon: 'align.right', accessibilityLabel: 'Align right' },
            ]}
            value={design.align}
            onChange={(align) => update({ align })}
          />
        </View>
        <View style={styles.half}>
          <Segmented<VerticalAlign>
            options={[
              { value: 'top', icon: 'position.top', accessibilityLabel: 'Top' },
              { value: 'center', icon: 'position.center', accessibilityLabel: 'Middle' },
              { value: 'bottom', icon: 'position.bottom', accessibilityLabel: 'Bottom' },
            ]}
            value={design.vAlign}
            onChange={(vAlign) => update({ vAlign })}
          />
        </View>
      </View>

      <SliderRow
        label="Editorial wave"
        value={design.curve}
        min={DESIGN_LIMITS.curve.min}
        max={DESIGN_LIMITS.curve.max}
        step={0.01}
        display={(v) => (v < 0.02 ? 'Off' : `${Math.round(v * 100)}%`)}
        onChange={(curve) => update({ curve })}
      />
      <SliderRow
        label="Padding"
        value={design.padding}
        min={DESIGN_LIMITS.padding.min}
        max={DESIGN_LIMITS.padding.max}
        step={1}
        display={(v) => String(Math.round(v))}
        onChange={(padding) => update({ padding })}
      />

      <Pressable
        onPress={() => setAdvanced((a) => !a)}
        accessibilityRole="button"
        accessibilityState={{ expanded: advanced }}
        style={styles.disclosure}>
        <Text variant="subhead" color="textSecondary">
          Advanced
        </Text>
        <View style={{ transform: [{ rotate: advanced ? '180deg' : '0deg' }] }}>
          <Icon name="chevron.down" size={14} color={theme.textSecondary} weight="semibold" />
        </View>
      </Pressable>

      {advanced && (
        <>
          <SliderRow
            label="Text width"
            value={design.textWidth}
            min={DESIGN_LIMITS.textWidth.min}
            max={DESIGN_LIMITS.textWidth.max}
            step={0.01}
            display={(v) => `${Math.round(v * 100)}%`}
            onChange={(textWidth) => update({ textWidth })}
          />
          <SliderRow
            label="Top offset"
            value={design.topOffset}
            min={DESIGN_LIMITS.topOffset.min}
            max={DESIGN_LIMITS.topOffset.max}
            step={0.01}
            display={(v) => `${Math.round(v * 100)}%`}
            onChange={(topOffset) => update({ topOffset })}
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, alignSelf: 'flex-start' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36, marginTop: spacing.xs },
  hintText: { flex: 1 },
});
