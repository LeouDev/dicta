import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/ui/text-field';
import { spacing } from '@/constants/tokens';
import { isDeviceFrame } from '@/features/quote-card/geometry';
import { DESIGN_LIMITS, SIGNATURE_MAX_LENGTH, type CardAuthor, type SignatureStyle } from '@/features/quote-card/types';

import { SectionLabel, Segmented, SliderRow, ToggleRow } from './controls';
import { useComposer } from './store';

export function ProfileControls({ author }: { author: CardAuthor }) {
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const header = design.header;
  const device = isDeviceFrame(design.frame);

  return (
    <>
      {!device && design.frame !== 'notification' && (
        <>
          <SectionLabel>Identity</SectionLabel>
          <ToggleRow label="Profile header" value={header.show} onChange={(show) => update({ header: { show } })} />
          {header.show && (
            <View style={styles.nested}>
              <ToggleRow label="Profile photo" value={header.avatar} onChange={(avatar) => update({ header: { avatar } })} />
              <ToggleRow label="Name" value={header.name} onChange={(name) => update({ header: { name } })} />
              <ToggleRow label="Username" value={header.username} onChange={(username) => update({ header: { username } })} />
              {author.isVerified && <ToggleRow label="Verified badge" value={header.verified} onChange={(verified) => update({ header: { verified } })} />}
              <Segmented
                options={[
                  { value: 'top-left', label: 'Left' },
                  { value: 'top-center', label: 'Center' },
                ]}
                value={header.position}
                onChange={(position) => update({ header: { position } })}
              />
              <SliderRow
                label="Header size"
                value={header.scale}
                min={DESIGN_LIMITS.headerScale.min}
                max={DESIGN_LIMITS.headerScale.max}
                step={0.01}
                display={(v) => `${Math.round(v * 100)}%`}
                onChange={(scale) => update({ header: { scale } })}
              />
            </View>
          )}
        </>
      )}

      {!device && (
        <>
          <SectionLabel>Signature</SectionLabel>
          <ToggleRow label="Sign the card" value={design.signature.show} onChange={(show) => update({ signature: { show } })} />
          {design.signature.show && (
            <>
              <TextField
                label="Signature"
                value={design.signature.text}
                placeholder={`— ${author.displayName}`}
                maxLength={SIGNATURE_MAX_LENGTH}
                onChangeText={(text) => update({ signature: { text } })}
                returnKeyType="done"
              />
              <Segmented<SignatureStyle>
                options={[
                  { value: 'script', label: 'Script' },
                  { value: 'serif', label: 'Serif' },
                  { value: 'caps', label: 'Caps' },
                  { value: 'note', label: 'Note' },
                ]}
                value={design.signature.style}
                onChange={(style) => update({ signature: { style } })}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  nested: { gap: spacing.xxs },
});
