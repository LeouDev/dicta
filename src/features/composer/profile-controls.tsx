import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/ui/text-field';
import { spacing } from '@/constants/tokens';
import { DESIGN_LIMITS, type CardAuthor } from '@/features/quote-card/types';

import { SectionLabel, SliderRow, ToggleRow } from './controls';
import { useComposer } from './store';

export function ProfileControls({ author }: { author: CardAuthor }) {
  const design = useComposer((s) => s.design);
  const update = useComposer((s) => s.update);
  const defaultSignature = `— ${author.displayName}`;

  return (
    <>
      <SectionLabel>Identity</SectionLabel>
      <ToggleRow label="Profile header" value={design.showProfile} onChange={(showProfile) => update({ showProfile })} />
      {design.showProfile && (
        <View style={styles.nested}>
          <ToggleRow label="Profile photo" value={design.showAvatar} onChange={(showAvatar) => update({ showAvatar })} />
          <ToggleRow label="Username" value={design.showUsername} onChange={(showUsername) => update({ showUsername })} />
          {author.isVerified && (
            <ToggleRow label="Verified badge" value={design.showVerifiedBadge} onChange={(showVerifiedBadge) => update({ showVerifiedBadge })} />
          )}
          <SliderRow
            label="Header size"
            value={design.headerSize}
            min={DESIGN_LIMITS.headerSize.min}
            max={DESIGN_LIMITS.headerSize.max}
            step={1}
            display={(v) => String(Math.round(v))}
            onChange={(headerSize) => update({ headerSize })}
          />
        </View>
      )}

      <SectionLabel>Signature</SectionLabel>
      <ToggleRow
        label="Sign the card"
        value={design.showSignature}
        onChange={(showSignature) => update({ showSignature, signature: design.signature || defaultSignature })}
      />
      {design.showSignature && (
        <TextField
          label="Signature"
          value={design.signature}
          placeholder={defaultSignature}
          maxLength={60}
          onChangeText={(signature) => update({ signature })}
          returnKeyType="done"
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  nested: { gap: spacing.xxs },
});
