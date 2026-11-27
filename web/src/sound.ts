// Optional WebAudio cues: only after a trusted gesture, only on deliberate
// actions and confirmed results, never in place of visible feedback. If audio
// is unavailable, nothing happens and play continues.

const KEY = 'linejam:muted';
let context: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    // Preference not persisted; the toggle still applies to this page.
  }
}

const CUES = {
  tap: [[392, 0, 0.05]],
  tucked: [[523.25, 0, 0.09], [659.25, 0.08, 0.14]],
  reveal: [[392, 0, 0.1], [523.25, 0.09, 0.1], [659.25, 0.18, 0.2]],
  heart: [[587.33, 0, 0.12]],
} as const satisfies Record<string, readonly (readonly [number, number, number])[]>;

export function cue(name: keyof typeof CUES): void {
  if (isMuted() || !navigator.userActivation?.hasBeenActive) return;
  try {
    context ??= new AudioContext();
    const start = context.currentTime;
    for (const [frequency, offset, length] of CUES[name]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(0.06, start + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + length + 0.02);
    }
  } catch {
    // Unavailable audio never blocks play.
  }
}
