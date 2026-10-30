import { useCallback } from 'react';
import type { Player } from '../engine/types';
import { useStore } from '../state/AppStore';

export type SoundName = 'placeX' | 'placeO' | 'win' | 'lose' | 'draw' | 'click';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** [frequency Hz, start offset s, duration s] */
type Note = [number, number, number];

const SOUNDS: Record<SoundName, { wave: OscillatorType; gain: number; notes: Note[] }> = {
  placeX: { wave: 'triangle', gain: 0.5, notes: [[520, 0, 0.09]] },
  placeO: { wave: 'triangle', gain: 0.5, notes: [[390, 0, 0.09]] },
  click: { wave: 'sine', gain: 0.25, notes: [[660, 0, 0.04]] },
  win: { wave: 'triangle', gain: 0.45, notes: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.3]] },
  lose: { wave: 'sine', gain: 0.45, notes: [[392, 0, 0.16], [330, 0.14, 0.16], [262, 0.28, 0.35]] },
  draw: { wave: 'sine', gain: 0.4, notes: [[440, 0, 0.14], [440, 0.18, 0.2]] },
};

export const placeSound = (p: Player): SoundName => (p === 'X' ? 'placeX' : 'placeO');

export function useSound() {
  const { settings } = useStore();
  return useCallback(
    (name: SoundName) => {
      if (!settings.sound || settings.volume <= 0) return;
      const ac = audio();
      if (!ac) return;
      const { wave, gain, notes } = SOUNDS[name];
      const now = ac.currentTime;
      for (const [freq, start, dur] of notes) {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        const peak = gain * settings.volume * 0.4;
        g.gain.setValueAtTime(0.0001, now + start);
        g.gain.exponentialRampToValueAtTime(peak, now + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(g).connect(ac.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      }
    },
    [settings.sound, settings.volume],
  );
}
