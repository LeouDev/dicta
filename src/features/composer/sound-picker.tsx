import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/tokens';
import { SOUND_IDS, SOUNDS, type SoundId } from '@/features/quote-card/types';
import { playSound, stopSound, useSoundOwner } from '@/features/sound/player';
import { useTheme } from '@/hooks/use-theme';

import { Chip, ChipScroller, SectionLabel } from './controls';
import { useComposer } from './store';

const MUSIC: readonly SoundId[] = ['piano', 'mellow'];

/** The card's sound. Choosing one plays it; choosing it again stops the preview. */
export function SoundPicker() {
  const theme = useTheme();
  const sound = useComposer((s) => s.design.sound);
  const update = useComposer((s) => s.update);
  const previewing = useSoundOwner((s) => s.owner === 'draft');
  // Leaving the tab, or the editor, ends the preview.
  useEffect(() => () => stopSound('draft'), []);

  const choose = (next: SoundId | null) => {
    if (next && !(next === sound && previewing)) playSound(next, 'draft');
    else stopSound('draft');
    update({ sound: next });
  };
  const icon = (id: SoundId): IconName => (id === sound && previewing ? 'sound' : MUSIC.includes(id) ? 'music' : 'waveform');

  return (
    <>
      <SectionLabel>Sound</SectionLabel>
      <ChipScroller>
        <Chip label="None" selected={sound === null} onPress={() => choose(null)} preview={<Icon name="close" size={22} color={theme.textSecondary} />} />
        {SOUND_IDS.map((id) => (
          <Chip key={id} label={SOUNDS[id]} selected={sound === id} onPress={() => choose(id)} preview={<Icon name={icon(id)} size={22} color={theme.text} />} />
        ))}
      </ChipScroller>
      <Text variant="caption" color="textSecondary" style={styles.note}>
        People tap the speaker on your card to hear it. Public-domain recordings, free to use.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.md },
});
