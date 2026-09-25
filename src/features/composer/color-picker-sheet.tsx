import Slider from '@react-native-community/slider';
import { Canvas, LinearGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, spacing } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { HEX_COLOR, hexToHsv, hsvToHex, type Hsv } from '@/utils/color';

const HUES = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];
const TRACK_HEIGHT = 12;

interface ColorPickerSheetProps {
  visible: boolean;
  title: string;
  initial: string;
  onChange: (hex: string) => void;
  onClose: () => void;
}

/** Advanced color picker: hue / saturation / brightness, or a hex code. Applies live. */
export function ColorPickerSheet({ visible, title, initial, onChange, onClose }: ColorPickerSheetProps) {
  const theme = useTheme();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initial));
  const [hexText, setHexText] = useState(initial);
  const hex = hsvToHex(hsv);

  const apply = (next: Hsv) => {
    setHsv(next);
    const value = hsvToHex(next);
    setHexText(value);
    onChange(value);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Text variant="headline">{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <Text variant="bodyStrong" color="accent">
              Done
            </Text>
          </Pressable>
        </View>

        <View style={[styles.preview, { backgroundColor: hex, borderColor: theme.hairline }]} accessibilityLabel={`Selected color ${hex}`} />

        <GradientSlider label="Hue" colors={HUES} value={hsv.h} max={360} onChange={(h) => apply({ ...hsv, h })} />
        <GradientSlider
          label="Saturation"
          colors={[hsvToHex({ ...hsv, s: 0 }), hsvToHex({ ...hsv, s: 1 })]}
          value={hsv.s}
          max={1}
          onChange={(s) => apply({ ...hsv, s })}
        />
        <GradientSlider
          label="Brightness"
          colors={['#000000', hsvToHex({ ...hsv, v: 1 })]}
          value={hsv.v}
          max={1}
          onChange={(v) => apply({ ...hsv, v })}
        />

        <View style={styles.hex}>
          <TextField
            label="Hex"
            value={hexText}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            onChangeText={(t) => {
              const value = t.startsWith('#') ? t : `#${t}`;
              setHexText(value);
              if (HEX_COLOR.test(value)) {
                setHsv(hexToHsv(value));
                onChange(value.toUpperCase());
              }
            }}
            error={HEX_COLOR.test(hexText) ? null : 'Use six hex digits, like #8A0F10.'}
          />
        </View>
      </View>
    </Modal>
  );
}

function GradientSlider({ label, colors, value, max, onChange }: { label: string; colors: string[]; value: number; max: number; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={styles.sliderBlock}>
      <Text variant="subhead" color="textSecondary">
        {label}
      </Text>
      <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <RoundedRect x={0} y={(36 - TRACK_HEIGHT) / 2} width={width} height={TRACK_HEIGHT} r={TRACK_HEIGHT / 2}>
              <LinearGradient start={vec(0, 0)} end={vec(width, 0)} colors={colors} />
            </RoundedRect>
          </Canvas>
        )}
        <Slider
          accessibilityLabel={label}
          minimumValue={0}
          maximumValue={max}
          value={value}
          onValueChange={onChange}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          style={styles.slider}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  preview: { height: 88, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  sliderBlock: { gap: spacing.xs },
  track: { height: 36, justifyContent: 'center' },
  slider: { height: 36 },
  hex: { marginTop: spacing.sm },
});
