import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_ENABLED_STORAGE_KEY,
  AUDIO_VOLUME_STORAGE_KEY,
  AudioController,
  DEFAULT_PARLOR_SOUNDS,
  createAudioController,
  type AudioEngineLike,
  type SoundName,
  type StorageLike,
} from "../src/index.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function createMockEngine(): {
  engine: AudioEngineLike;
  played: Array<{ sound?: SoundName; options?: { volume?: number } }>;
  enabledCalls: boolean[];
  volumeCalls: number[];
  bindCalls: Array<ParentNode | undefined>;
} {
  const played: Array<{ sound?: SoundName; options?: { volume?: number } }> = [];
  const enabledCalls: boolean[] = [];
  const volumeCalls: number[] = [];
  const bindCalls: Array<ParentNode | undefined> = [];

  const engine: AudioEngineLike = {
    play: (sound, options) => {
      played.push({ sound, options });
    },
    setEnabled: (enabled) => {
      enabledCalls.push(enabled);
    },
    setVolume: (volume) => {
      volumeCalls.push(volume);
    },
    bind: (root) => {
      bindCalls.push(root);
    },
  };

  return { engine, played, enabledCalls, volumeCalls, bindCalls };
}

describe("AudioController", () => {
  it("initializes with default enabled and volume and syncs with engine", () => {
    const mock = createMockEngine();
    const controller = createAudioController({ engine: mock.engine, storage: null });

    expect(controller.getSnapshot()).toEqual({ enabled: true, volume: 1 });
    expect(mock.enabledCalls).toEqual([true]);
    expect(mock.volumeCalls).toEqual([1]);
  });

  it("plays semantic cues mapped to default cuelume sounds", () => {
    const mock = createMockEngine();
    const controller = createAudioController({ engine: mock.engine, storage: null });

    controller.play("join");
    expect(mock.played).toEqual([{ sound: DEFAULT_PARLOR_SOUNDS.join, options: undefined }]);

    controller.play("start", { volume: 0.5 });
    expect(mock.played[1]).toEqual({
      sound: DEFAULT_PARLOR_SOUNDS.start,
      options: { volume: 0.5 },
    });

    controller.play("win");
    expect(mock.played[2]).toEqual({ sound: DEFAULT_PARLOR_SOUNDS.win, options: undefined });
  });

  it("allows custom sound overrides", () => {
    const mock = createMockEngine();
    const controller = createAudioController({
      engine: mock.engine,
      storage: null,
      sounds: {
        join: "chime",
      },
    });

    controller.play("join");
    expect(mock.played).toEqual([{ sound: "chime", options: undefined }]);
  });

  it("plays raw sounds directly", () => {
    const mock = createMockEngine();
    const controller = createAudioController({ engine: mock.engine, storage: null });

    controller.playRaw("droplet", { volume: 0.8 });
    expect(mock.played).toEqual([{ sound: "droplet", options: { volume: 0.8 } }]);
  });

  it("silently suppresses playback when disabled", () => {
    const mock = createMockEngine();
    const controller = createAudioController({
      engine: mock.engine,
      storage: null,
      enabled: false,
    });

    controller.play("join");
    controller.playRaw("sparkle");
    expect(mock.played).toHaveLength(0);
  });

  it("toggles enabled state, persists to storage, and notifies listeners", () => {
    const mock = createMockEngine();
    const storage = new MemoryStorage();
    const controller = createAudioController({ engine: mock.engine, storage });

    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    const firstSnapshot = controller.getSnapshot();
    expect(firstSnapshot.enabled).toBe(true);

    const newEnabled = controller.toggleEnabled();
    expect(newEnabled).toBe(false);
    expect(controller.getSnapshot().enabled).toBe(false);
    expect(storage.getItem(AUDIO_ENABLED_STORAGE_KEY)).toBe("false");
    expect(mock.enabledCalls).toEqual([true, false]);
    expect(listener).toHaveBeenCalledTimes(1);

    // Snapshot reference changed on update
    expect(controller.getSnapshot()).not.toBe(firstSnapshot);

    unsubscribe();
    controller.setEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(storage.getItem(AUDIO_ENABLED_STORAGE_KEY)).toBe("true");
  });

  it("clamps volume between 0 and 1, persists, and notifies listeners", () => {
    const mock = createMockEngine();
    const storage = new MemoryStorage();
    const controller = createAudioController({ engine: mock.engine, storage });

    const listener = vi.fn();
    controller.subscribe(listener);

    controller.setVolume(0.4);
    expect(controller.getSnapshot().volume).toBe(0.4);
    expect(storage.getItem(AUDIO_VOLUME_STORAGE_KEY)).toBe("0.4");
    expect(mock.volumeCalls).toEqual([1, 0.4]);

    controller.setVolume(1.5);
    expect(controller.getSnapshot().volume).toBe(1);
    expect(storage.getItem(AUDIO_VOLUME_STORAGE_KEY)).toBe("1");

    controller.setVolume(-0.2);
    expect(controller.getSnapshot().volume).toBe(0);
    expect(storage.getItem(AUDIO_VOLUME_STORAGE_KEY)).toBe("0");
  });

  it("restores preferences from storage upon initialization", () => {
    const mock = createMockEngine();
    const storage = new MemoryStorage();
    storage.setItem(AUDIO_ENABLED_STORAGE_KEY, "false");
    storage.setItem(AUDIO_VOLUME_STORAGE_KEY, "0.65");

    const controller = new AudioController({ engine: mock.engine, storage });
    expect(controller.getSnapshot()).toEqual({ enabled: false, volume: 0.65 });
    expect(mock.enabledCalls).toEqual([false]);
    expect(mock.volumeCalls).toEqual([0.65]);
  });

  it("caches snapshot reference when state has not changed", () => {
    const mock = createMockEngine();
    const controller = createAudioController({ engine: mock.engine, storage: null });

    const snap1 = controller.getSnapshot();
    const snap2 = controller.getSnapshot();
    expect(snap1).toBe(snap2);

    // Setting same volume does not create a new snapshot or notify
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setVolume(1);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toBe(snap1);
  });

  it("forwards bind calls to the engine", () => {
    const mock = createMockEngine();
    const controller = createAudioController({ engine: mock.engine, storage: null });

    controller.bind();
    expect(mock.bindCalls).toEqual([undefined]);
  });
});
