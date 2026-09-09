import {
  bind as cuelumeBind,
  play as cuelumePlay,
  setEnabled as cuelumeSetEnabled,
  setVolume as cuelumeSetVolume,
  sounds,
  type SoundName,
} from "cuelume";
import { defaultStorage, type StorageLike } from "./browser.js";

export { sounds, type SoundName };

/**
 * Semantic sound cues used across Parlor party-game UI and room lifecycles.
 */
export type ParlorSoundCue =
  // UI interaction cues
  | "press"
  | "release"
  | "tap"
  | "toggle"
  | "digit"
  | "backspace"
  | "copy"
  // Game lifecycle cues
  | "join"
  | "leave"
  | "ready"
  | "start"
  | "reveal"
  | "turn"
  | "countdown"
  | "buzzer"
  | "invalid"
  | "error"
  | "success"
  | "win"
  | "stale"
  | "migrate";

/**
 * Opinionated mapping of semantic party-game cues to synthesized Web Audio sounds.
 */
export const DEFAULT_PARLOR_SOUNDS: Readonly<Record<ParlorSoundCue, SoundName>> = {
  press: "press",
  release: "release",
  tap: "release",
  toggle: "toggle",
  digit: "tick",
  backspace: "droplet",
  copy: "success",
  join: "sparkle",
  leave: "droplet",
  ready: "ready",
  start: "bloom",
  reveal: "bloom",
  turn: "page",
  countdown: "tick",
  buzzer: "error",
  invalid: "error",
  error: "error",
  success: "success",
  win: "success",
  stale: "whisper",
  migrate: "arrival",
};

export interface AudioPlayOptions {
  /** Relative volume override for this play only (0–1). */
  volume?: number;
}

export interface AudioEngineLike {
  play(name?: SoundName, options?: AudioPlayOptions): void;
  setEnabled(enabled: boolean): void;
  setVolume(volume: number): void;
  bind(root?: ParentNode): void;
}

const defaultEngine: AudioEngineLike = {
  play: cuelumePlay,
  setEnabled: cuelumeSetEnabled,
  setVolume: cuelumeSetVolume,
  bind: cuelumeBind,
};

export const AUDIO_ENABLED_STORAGE_KEY = "parlor:audio-enabled";
export const AUDIO_VOLUME_STORAGE_KEY = "parlor:audio-volume";

export interface AudioSnapshot {
  readonly enabled: boolean;
  readonly volume: number;
}

export interface AudioControllerOptions {
  /** Initial enabled state. Defaults to storage value, or true if none. */
  enabled?: boolean;
  /** Initial volume multiplier (0–1). Defaults to storage value, or 1 if none. */
  volume?: number;
  /** Storage backend for persisting user mute/volume choices. Pass null to disable persistence. */
  storage?: StorageLike | null;
  /** Custom storage key for enabled/muted state. */
  storageKey?: string;
  /** Custom storage key for volume multiplier. */
  volumeStorageKey?: string;
  /** Custom overrides for semantic sound mappings. */
  sounds?: Partial<Record<ParlorSoundCue, SoundName>>;
  /** Injectable audio engine (for unit tests or alternative synthesizers). */
  engine?: AudioEngineLike;
}

const SERVER_SNAPSHOT: AudioSnapshot = Object.freeze({
  enabled: true,
  volume: 1,
});

/**
 * Controls game audio cues, volume, and mute state with optional browser persistence.
 */
export class AudioController {
  private readonly storage: StorageLike | null;
  private readonly engine: AudioEngineLike;
  private readonly soundMap: Readonly<Record<ParlorSoundCue, SoundName>>;
  private readonly enabledStorageKey: string;
  private readonly volumeStorageKey: string;
  private readonly listeners = new Set<() => void>();

  private enabled: boolean;
  private volume: number;
  private snapshot: AudioSnapshot;

  constructor(options: AudioControllerOptions = {}) {
    this.storage = options.storage !== undefined ? options.storage : defaultStorage();
    this.engine = options.engine ?? defaultEngine;
    this.soundMap = Object.freeze({ ...DEFAULT_PARLOR_SOUNDS, ...options.sounds });
    this.enabledStorageKey = options.storageKey ?? AUDIO_ENABLED_STORAGE_KEY;
    this.volumeStorageKey = options.volumeStorageKey ?? AUDIO_VOLUME_STORAGE_KEY;

    let initialEnabled = options.enabled;
    if (initialEnabled === undefined && this.storage !== null) {
      try {
        const stored = this.storage.getItem(this.enabledStorageKey);
        if (stored !== null) {
          initialEnabled = stored !== "false";
        }
      } catch {
        initialEnabled = true;
      }
    }

    let initialVolume = options.volume;
    if (initialVolume === undefined && this.storage !== null) {
      try {
        const stored = this.storage.getItem(this.volumeStorageKey);
        if (stored !== null) {
          const parsed = Number.parseFloat(stored);
          if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
            initialVolume = parsed;
          }
        }
      } catch {
        initialVolume = 1;
      }
    }

    this.enabled = initialEnabled ?? true;
    this.volume = Math.max(0, Math.min(1, initialVolume ?? 1));
    this.snapshot = Object.freeze({ enabled: this.enabled, volume: this.volume });

    this.engine.setEnabled(this.enabled);
    this.engine.setVolume(this.volume);
  }

  /**
   * Plays a semantic party-game sound cue if audio is enabled.
   */
  play(cue: ParlorSoundCue, options?: AudioPlayOptions): void {
    if (!this.enabled) {
      return;
    }
    const soundName = this.soundMap[cue] ?? DEFAULT_PARLOR_SOUNDS[cue];
    this.engine.play(soundName, options);
  }

  /**
   * Plays a specific synthesized sound by raw name if audio is enabled.
   */
  playRaw(sound: SoundName, options?: AudioPlayOptions): void {
    if (!this.enabled) {
      return;
    }
    this.engine.play(sound, options);
  }

  /**
   * Sets whether audio playback is enabled and persists the setting if storage is configured.
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    this.engine.setEnabled(enabled);
    this.persist(this.enabledStorageKey, String(enabled));
    this.emitChange();
  }

  /**
   * Toggles mute state and returns the new enabled state.
   */
  toggleEnabled(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Sets the global volume multiplier (clamped to 0–1) and persists the setting.
   */
  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    if (this.volume === clamped) {
      return;
    }
    this.volume = clamped;
    this.engine.setVolume(clamped);
    this.persist(this.volumeStorageKey, String(clamped));
    this.emitChange();
  }

  /**
   * Wires up delegated listeners for declarative `data-cuelume-*` attributes under `root`.
   */
  bind(root?: ParentNode): void {
    this.engine.bind(root);
  }

  /**
   * Subscribes to audio state changes (enabled/volume). Returns an unsubscribe function.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Returns a cached snapshot of current audio state for React's useSyncExternalStore.
   */
  getSnapshot = (): AudioSnapshot => {
    return this.snapshot;
  };

  /**
   * Returns a server-safe snapshot for SSR.
   */
  getServerSnapshot = (): AudioSnapshot => {
    return SERVER_SNAPSHOT;
  };

  private persist(key: string, value: string): void {
    if (this.storage === null) {
      return;
    }
    try {
      this.storage.setItem(key, value);
    } catch {
      // Storage failure is non-fatal for audio preferences.
    }
  }

  private emitChange(): void {
    this.snapshot = Object.freeze({ enabled: this.enabled, volume: this.volume });
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Listener errors should not break state notification.
      }
    }
  }
}

/**
 * Creates an AudioController instance.
 */
export function createAudioController(options: AudioControllerOptions = {}): AudioController {
  return new AudioController(options);
}

/**
 * Convenience helper to delegate declarative interaction sound listeners under root.
 */
export function bindAudioCues(root?: ParentNode): void {
  cuelumeBind(root);
}

/**
 * Direct imperative playback helper for raw synthesized sounds.
 */
export function playRawSound(name?: SoundName, options?: AudioPlayOptions): void {
  cuelumePlay(name, options);
}
