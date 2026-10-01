import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

const AryadiChime = require('../../assets/sounds/aryadi-chime.wav');

let player: AudioPlayer | null = null;

/** Plays the Aryadi Chime once; failures (e.g. browser autoplay blocking) are ignored. */
export function playAryadiChime() {
  try {
    if (!player) {
      player = createAudioPlayer(AryadiChime);
      player.play();
      return;
    }
    const current = player;
    current.pause();
    void current
      .seekTo(0)
      .catch(() => undefined)
      .then(() => current.play());
  } catch {
    // Sound is a nice-to-have; never let it break the screen.
  }
}

export function stopAryadiChime() {
  try {
    player?.pause();
  } catch {
    // ignore
  }
}
