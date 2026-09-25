import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { hitTarget, radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="overline" color="textTertiary" style={styles.sectionLabel}>
      {children}
    </Text>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: (value: number) => string;
  onChange: (value: number) => void;
}

export function SliderRow({ label, value, min, max, step = 0, display, onChange }: SliderRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text variant="subhead">{label}</Text>
        <Text variant="caption" color="textTertiary" style={styles.tabular}>
          {display(value)}
        </Text>
      </View>
      <Slider
        accessibilityLabel={label}
        accessibilityValue={{ text: display(value) }}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={theme.text}
        maximumTrackTintColor={theme.hairline}
        style={styles.slider}
      />
    </View>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label?: string;
  icon?: IconName;
  accessibilityLabel?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surface }]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        const fg = selected ? theme.onPrimary : theme.textSecondary;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            style={[styles.segment, selected && { backgroundColor: theme.primary }]}>
            {option.icon && <Icon name={option.icon} size={17} color={fg} weight="medium" />}
            {option.label && (
              <Text variant="subhead" style={{ color: fg }}>
                {option.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

interface SwatchRowProps {
  colors: { name: string; value: string }[];
  value: string | null;
  onChange: (value: string) => void;
  onCustom?: () => void;
}

export function SwatchRow({ colors, value, onChange, onCustom }: SwatchRowProps) {
  const theme = useTheme();
  const isCustom = value !== null && !colors.some((c) => c.value.toUpperCase() === value.toUpperCase());
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
      {onCustom && (
        <Pressable
          onPress={onCustom}
          accessibilityRole="button"
          accessibilityLabel="Custom color"
          style={[styles.swatchRing, isCustom && { borderColor: theme.text }]}>
          <View style={[styles.swatch, styles.customSwatch, { backgroundColor: isCustom ? value : theme.surface, borderColor: theme.hairline }]}>
            <Icon name="eyedropper" size={15} color={isCustom ? '#FFFFFF' : theme.textSecondary} />
          </View>
        </Pressable>
      )}
      {/* `hex` rather than `c.value`: Reanimated's Babel plugin flags any `.value` inside an inline style. */}
      {colors.map(({ name, value: hex }) => {
        const selected = value?.toUpperCase() === hex.toUpperCase();
        return (
          <Pressable
            key={hex}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(hex);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={name}
            style={[styles.swatchRing, selected && { borderColor: theme.text }]}>
            <View style={[styles.swatch, { backgroundColor: hex, borderColor: theme.hairline }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Text variant="body">{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          onChange(v);
        }}
        trackColor={{ true: theme.accent }}
        accessibilityLabel={label}
      />
    </View>
  );
}

interface ChipProps {
  selected: boolean;
  onPress: () => void;
  label: string;
  preview?: ReactNode;
}

/** Tall option tile with a visual preview above its label (fonts, textures, formats). */
export function Chip({ selected, onPress, label, preview }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        { backgroundColor: theme.surface, borderColor: selected ? theme.text : 'transparent' },
      ]}>
      {preview}
      <Text variant="caption" color={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.md, marginBottom: spacing.sm },
  sliderRow: { marginTop: spacing.sm },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tabular: { fontVariant: ['tabular-nums'] },
  slider: { height: 36, marginHorizontal: -2 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.md - 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  swatches: { gap: spacing.xs, paddingRight: spacing.lg, alignItems: 'center' },
  swatchRing: { padding: 3, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  swatch: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  customSwatch: { alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: hitTarget },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    minWidth: 76,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: spacing.xs,
  },
});
