/**
 * The sound when rest ends, generated rather than a file, so it costs nothing to load. Browsers
 * only allow sound after a tap, so `unlockRestSound` runs on the tap that starts the rest. Native
 * builds get no sound yet, only the buzz.
 */
import { Platform } from 'react-native';

let context: AudioContext | null = null;

/** Call from a tap. */
export function unlockRestSound(): void {
  if (Platform.OS !== 'web' || typeof AudioContext === 'undefined') return;
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch {
    context = null;
  }
}

/** Two short tones. Silent if nothing has unlocked sound. */
export function playRestSound(): void {
  if (!context) return;
  try {
    void context.resume();
    for (const at of [0, 0.22]) {
      const start = context.currentTime + at;
      const tone = context.createOscillator();
      const gain = context.createGain();
      tone.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      tone.connect(gain).connect(context.destination);
      tone.start(start);
      tone.stop(start + 0.17);
    }
  } catch {
    // Sound is a nicety; the vibration and the timer still tell the user.
  }
}
