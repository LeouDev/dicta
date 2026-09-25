import { Canvas, Fill, LinearGradient, Rect, RoundedRect, Shader, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/tokens';
import { gradientPoints } from '@/features/quote-card/geometry';
import { BACKGROUND_COLORS, GRADIENTS, isDarkDesign } from '@/features/quote-card/palettes';
import { TEXTURE_KIND, TEXTURE_LABELS, textureBlend, textureEffect } from '@/features/quote-card/textures';
import { DESIGN_LIMITS, TEXTURES, type CardBackground, type Overlay, type TextureKey } from '@/features/quote-card/types';
import { useTheme } from '@/hooks/use-theme';

import { ColorPickerSheet } from './color-picker-sheet';
import { Chip, ChipScroller, SectionLabel, Segmented, SliderRow, SwatchRow } from './controls';
import { clearDraftPhotos, pickBackgroundPhoto } from './photo';
import { useComposer } from './store';

const SWATCH = 44;

export function BackgroundPicker() {
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const setBackground = useComposer((s) => s.setBackground);
  const [picking, setPicking] = useState<'color' | 'color2' | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const bg = design.background;
  const dark = isDarkDesign(design);

  const choosePhoto = async () => {
    setPhotoError(null);
    try {
      const uri = await pickBackgroundPhoto();
      if (!uri) return;
      clearDraftPhotos(uri);
      setBackground({ type: 'image', image: uri, path: undefined });
    } catch {
      setPhotoError('That photo couldn’t be opened. Try another one.');
    }
  };

  const switchType = (type: CardBackground['type']) => {
    if (type === 'image' && !bg.image) return void choosePhoto();
    setBackground({ type });
  };

  return (
    <>
      <SectionLabel>Background</SectionLabel>
      <Segmented
        options={[
          { value: 'solid', label: 'Color' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'split', label: 'Split' },
          { value: 'image', label: 'Photo' },
        ]}
        value={bg.type}
        onChange={switchType}
      />

      <View style={styles.body}>
        {bg.type === 'solid' && (
          <SwatchRow colors={BACKGROUND_COLORS} value={bg.color} onChange={(color) => setBackground({ color })} onCustom={() => setPicking('color')} />
        )}

        {bg.type === 'gradient' && (
          <>
            <ChipScroller>
              {GRADIENTS.map((g) => (
                <Chip
                  key={g.name}
                  label={g.name}
                  selected={g.color === bg.color && g.color2 === bg.color2}
                  onPress={() => setBackground({ color: g.color, color2: g.color2 })}
                  preview={<GradientSwatch colors={[g.color, g.color2]} angle={bg.angle} />}
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
              onChange={(angle) => update({ background: { angle } })}
            />
          </>
        )}

        {bg.type === 'split' && (
          <>
            <Text variant="caption" color="textSecondary">
              Left
            </Text>
            <SwatchRow colors={BACKGROUND_COLORS} value={bg.color} onChange={(color) => setBackground({ color })} onCustom={() => setPicking('color')} />
            <Text variant="caption" color="textSecondary">
              Right
            </Text>
            <SwatchRow colors={BACKGROUND_COLORS} value={bg.color2} onChange={(color2) => setBackground({ color2 })} onCustom={() => setPicking('color2')} />
          </>
        )}

        {bg.type === 'image' && (
          <>
            <PhotoRow uri={bg.image} onChoose={choosePhoto} />
            {photoError && (
              <Text variant="caption" color="danger">
                {photoError}
              </Text>
            )}
            <SectionLabel>Readability overlay</SectionLabel>
            <Segmented<Overlay>
              options={[
                { value: 'off', label: 'Off' },
                { value: 'auto', label: 'Auto' },
                { value: 'strong', label: 'Strong' },
              ]}
              value={bg.overlay}
              onChange={(overlay) => update({ background: { overlay } })}
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
            selected={design.texture.type === t}
            onPress={() => update({ texture: { type: t, strength: t === 'none' ? design.texture.strength : design.texture.strength || 0.6 } })}
            preview={<TextureSwatch texture={t} base={bg.type === 'image' ? '#2A2927' : bg.color} dark={dark} />}
          />
        ))}
      </ChipScroller>
      {design.texture.type !== 'none' && (
        <SliderRow
          label="Strength"
          value={design.texture.strength}
          min={DESIGN_LIMITS.strength.min}
          max={DESIGN_LIMITS.strength.max}
          step={0.01}
          display={(v) => `${Math.round(v * 100)}%`}
          onChange={(strength) => update({ texture: { strength } })}
        />
      )}

      {picking && (
        <ColorPickerSheet
          visible
          title={picking === 'color2' ? 'Right color' : 'Background color'}
          initial={bg[picking].slice(0, 7)}
          onChange={(hex) => setBackground({ [picking]: hex })}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}

function PhotoRow({ uri, onChoose }: { uri: string | null; onChoose: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.photoRow}>
      {uri ? (
        <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" accessibilityLabel="Background photo" />
      ) : (
        <View style={[styles.photoThumb, { backgroundColor: theme.surface }]} />
      )}
      <Button label={uri ? 'Replace photo' : 'Choose photo'} icon="photo" variant="secondary" size="md" onPress={onChoose} />
    </View>
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

function TextureSwatch({ texture, base, dark }: { texture: TextureKey; base: string; dark: boolean }) {
  const theme = useTheme();
  const blend = texture === 'none' ? null : textureBlend(texture, dark);
  return (
    <View style={[styles.swatch, styles.swatchClip, { borderColor: theme.hairline }]}>
      <Canvas style={styles.swatch} pointerEvents="none">
        <Fill color={base} />
        {texture !== 'none' && blend && textureEffect && (
          <Rect x={0} y={0} width={SWATCH} height={SWATCH} blendMode={blend.blendMode}>
            <Shader
              source={textureEffect}
              uniforms={{
                kind: TEXTURE_KIND[texture],
                intensity: 1,
                unit: 0.45,
                size: vec(SWATCH, SWATCH),
                seed: 7,
                dark: blend.dark,
                pitch: 9,
                phase: 7,
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
