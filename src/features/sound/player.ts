import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';
import { create } from 'zustand';

import type { SoundId } from '@/features/quote-card/types';
import { soundUrl } from '@/services/web';

/** Whose sound is playing: one at a time, for one card (a post id, or 'draft' in the editor). */
export const useSoundOwner = create<{ owner: string | null }>(() => ({ owner: null }));

let player: AudioPlayer | null = null;

/** Plays a card's sound on a loop, in place of whatever was playing. The silent switch doesn't mute it: people asked to hear it. */
export function playSound(sound: SoundId, owner: string) {
  if (player) player.replace(soundUrl(sound));
  else {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player = createAudioPlayer(soundUrl(sound));
  }
  player.loop = true;
  player.play();
  useSoundOwner.setState({ owner });
}

/** Stops the sound if it's this owner's (or whatever's playing, without one). */
export function stopSound(owner?: string) {
  if (owner !== undefined && useSoundOwner.getState().owner !== owner) return;
  player?.pause();
  useSoundOwner.setState({ owner: null });
}

export function toggleSound(sound: SoundId, owner: string) {
  if (useSoundOwner.getState().owner === owner) stopSound(owner);
  else playSound(sound, owner);
}

// Sounds don't play in the background (Control Center and the like leave them playing).
AppState.addEventListener('change', (state) => state === 'background' && stopSound());
