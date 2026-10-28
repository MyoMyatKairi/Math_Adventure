'use client';

/**
 * Short feedback sounds, synthesised with the Web Audio API so there are no
 * audio files to load. Off by default until the learner (or a grown-up) turns
 * it on; the choice is remembered on this device.
 */

export type SoundName = 'correct' | 'retry' | 'reveal' | 'combo' | 'complete';

const STORAGE_KEY = 'ma_sound';

// Notes as [frequency Hz, start s, length s].
const TUNES: Record<SoundName, [number, number, number][]> = {
  correct: [[659, 0, 0.12], [988, 0.09, 0.18]],
  retry: [[330, 0, 0.14], [294, 0.12, 0.2]],
  reveal: [[440, 0, 0.18]],
  combo: [[784, 0, 0.1], [988, 0.08, 0.1], [1319, 0.16, 0.22]],
  complete: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.36]],
};

let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the setting lasts for this page only.
  }
}

export function playSound(name: SoundName) {
  if (!soundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    for (const [freq, start, len] of TUNES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === 'retry' ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + len + 0.05);
    }
  } catch {
    // No audio support: stay silent.
  }
}
