import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { SOUNDS, type SoundId } from '@/features/quote-card/types';

import { stopSound, toggleSound, useSoundOwner } from './player';

/** The speaker on a card that has a sound: tap to play it on a loop, again to stop. Leaving the screen stops it. */
export function SoundButton({ sound, owner }: { sound: SoundId; owner: string }) {
  const playing = useSoundOwner((s) => s.owner === owner);
  useFocusEffect(useCallback(() => () => stopSound(owner), [owner]));

  return (
    <Pressable
      onPress={() => toggleSound(sound, owner)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Stop' : 'Play'} sound: ${SOUNDS[sound]}`}
      style={styles.pill}>
      <Icon name={playing ? 'sound' : 'sound.off'} size={13} color="#FFFFFF" />
      {playing && (
        <Text style={styles.label} allowFontScaling={false}>
          {SOUNDS[sound]}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8.5,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  label: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
