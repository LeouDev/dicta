import { Canvas, Fill, LinearGradient, Rect, RoundedRect, Shader, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { gradientPoints } from '@/features/quote-card/geometry';
import { BACKGROUND_COLORS, GRADIENTS } from '@/features/quote-card/palettes';
import { TEXTURE_KIND, TEXTURE_LABELS, textureBlend, textureEffect } from '@/features/quote-card/textures';
import { DESIGN_LIMITS, TEXTURES, type CardBackground, type TextureId } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

import { ColorPickerSheet } from './color-picker-sheet';
import { Chip, ChipScroller, SectionLabel, Segmented, SliderRow, SwatchRow } from './controls';
import { clearDraftPhotos, pickBackgroundPhoto } from './photo';
import { useComposer } from './store';

const SWATCH = 44;

export function BackgroundPicker() {
  const theme = useTheme();
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const setBackground = useComposer((s) => s.setBackground);
  const [picking, setPicking] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const bg = design.background;

  // Remember the last choice per type so switching back and forth is lossless.
  const last = useRef<Partial<Record<CardBackground['type'], CardBackground>>>({});

  const choosePhoto = async () => {
    setPhotoError(null);
    try {
      const uri = await pickBackgroundPhoto();
      if (!uri) return;
      clearDraftPhotos(uri);
      setBackground({ type: 'image', uri, dim: bg.type === 'image' ? bg.dim : 0.45 });
    } catch {
      setPhotoError('That photo couldn’t be opened. Try another one.');
    }
  };

  const switchType = (type: CardBackground['type']) => {
    last.current[bg.type] = bg;
    const previous = last.current[type];
    if (type === 'solid') setBackground(previous ?? { type: 'solid', color: '#FAF8F3' });
    if (type === 'gradient') setBackground(previous ?? { type: 'gradient', colors: GRADIENTS[0].colors, angle: 135 });
    if (type === 'image') {
      if (previous?.type === 'image' && previous.uri) setBackground(previous);
      else choosePhoto();
    }
  };

  return (
    <>
      <SectionLabel>Background</SectionLabel>
      <Segmented
        options={[
          { value: 'solid', label: 'Color' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'image', label: 'Photo' },
        ]}
        value={bg.type}
        onChange={switchType}
      />

      <View style={styles.body}>
        {bg.type === 'solid' && (
          <SwatchRow
            colors={BACKGROUND_COLORS}
            value={bg.color}
            onChange={(color) => setBackground({ type: 'solid', color })}
            onCustom={() => setPicking(true)}
          />
        )}

        {bg.type === 'gradient' && (
          <>
            <ChipScroller>
              {GRADIENTS.map((g) => (
                <Chip
                  key={g.name}
                  label={g.name}
                  selected={g.colors.join() === bg.colors.join()}
                  onPress={() => setBackground({ ...bg, colors: g.colors })}
                  preview={<GradientSwatch colors={g.colors} angle={bg.angle} />}
                />
              ))}
            </ChipScroller>
            <SliderRow
              label="Angle"
              value={bg.angle}
              min={DESIGN_LIMITS.angle.min}
              max={DESIGN_LIMITS.angle.max}
              step={1}
              display={(v) => `${Math.round(v)}°`}
              onChange={(angle) => update({ background: { ...bg, angle } })}
            />
          </>
        )}

        {bg.type === 'image' && (
          <>
            <View style={styles.photoRow}>
              {bg.uri ? (
                <Image source={{ uri: bg.uri }} style={styles.photoThumb} contentFit="cover" accessibilityLabel="Background photo" />
              ) : (
                <View style={[styles.photoThumb, { backgroundColor: theme.surface }]} />
              )}
              <Button label={bg.uri ? 'Replace photo' : 'Choose photo'} icon="photo" variant="secondary" size="md" onPress={choosePhoto} />
            </View>
            {photoError && (
              <Text variant="caption" color="danger">
                {photoError}
              </Text>
            )}
            <SliderRow
              label="Darken for readability"
              value={bg.dim}
              min={DESIGN_LIMITS.dim.min}
              max={DESIGN_LIMITS.dim.max}
              step={0.01}
              display={(v) => `${Math.round(v * 100)}%`}
              onChange={(dim) => update({ background: { ...bg, dim } })}
            />
          </>
        )}
      </View>

      <SectionLabel>Texture</SectionLabel>
      <ChipScroller>
        {TEXTURES.map((t) => (
          <Chip
            key={t}
            label={TEXTURE_LABELS[t]}
            selected={design.texture === t}
            onPress={() => update({ texture: t, textureIntensity: t === 'none' ? design.textureIntensity : design.textureIntensity || 0.6 })}
            preview={<TextureSwatch texture={t} background={bg} />}
          />
        ))}
      </ChipScroller>
      {design.texture !== 'none' && (
        <SliderRow
          label="Intensity"
          value={design.textureIntensity}
          min={DESIGN_LIMITS.textureIntensity.min}
          max={DESIGN_LIMITS.textureIntensity.max}
          step={0.01}
          display={(v) => `${Math.round(v * 100)}%`}
          onChange={(textureIntensity) => update({ textureIntensity })}
        />
      )}

      {picking && bg.type === 'solid' && (
        <ColorPickerSheet
          visible
          title="Background color"
          initial={bg.color.slice(0, 7)}
          onChange={(color) => setBackground({ type: 'solid', color })}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function GradientSwatch({ colors, angle }: { colors: string[]; angle: number }) {
  const { start, end } = gradientPoints(angle, { width: SWATCH, height: SWATCH });
  return (
    <Canvas style={styles.swatch} pointerEvents="none">
      <RoundedRect x={0} y={0} width={SWATCH} height={SWATCH} r={radius.sm}>
        <LinearGradient start={vec(start.x, start.y)} end={vec(end.x, end.y)} colors={colors} />
      </RoundedRect>
    </Canvas>
  );
}

function TextureSwatch({ texture, background }: { texture: TextureId; background: CardBackground }) {
  const theme = useTheme();
  const base = background.type === 'solid' ? background.color : background.type === 'gradient' ? background.colors[0] : '#2A2A2E';
  return (
    <View style={[styles.swatch, styles.swatchClip, { borderColor: theme.hairline }]}>
      <Canvas style={styles.swatch} pointerEvents="none">
        <Fill color={base} />
        {texture !== 'none' && textureEffect && (
          <Rect x={0} y={0} width={SWATCH} height={SWATCH} blendMode={textureBlend(texture, background).blendMode}>
            <Shader
              source={textureEffect}
              uniforms={{
                kind: TEXTURE_KIND[texture],
                intensity: 1,
                unit: 0.4,
                size: vec(SWATCH, SWATCH),
                seed: 7,
                dark: textureBlend(texture, background).dark,
              }}
            />
          </Rect>
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: spacing.md, gap: spacing.xs },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoThumb: { width: 56, height: 56, borderRadius: radius.sm },
  swatch: { width: SWATCH, height: SWATCH },
  swatchClip: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
