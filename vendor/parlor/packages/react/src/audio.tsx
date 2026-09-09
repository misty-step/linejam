import {
  createAudioController,
  type AudioController,
  type AudioControllerOptions,
  type AudioPlayOptions,
  type AudioSnapshot,
  type ParlorSoundCue,
  type SoundName,
} from "@parlor/web";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const AudioContext = createContext<AudioController | null>(null);

let sharedController: AudioController | null = null;

function getSharedAudioController(): AudioController {
  if (sharedController === null) {
    sharedController = createAudioController();
  }
  return sharedController;
}

export interface AudioProviderProps {
  /** Optional custom controller instance. */
  controller?: AudioController;
  /** Options used to initialize a controller if none is provided. */
  options?: AudioControllerOptions;
  /** Whether to automatically bind declarative data-cuelume-* attributes. Defaults to true. */
  autoBind?: boolean;
  children?: ReactNode;
}

/**
 * Provides an AudioController across the React tree.
 */
export function AudioProvider({
  controller: providedController,
  options,
  autoBind = true,
  children,
}: AudioProviderProps) {
  const [controller] = useState(() => providedController ?? createAudioController(options));

  useEffect(() => {
    if (autoBind) {
      controller.bind();
    }
  }, [controller, autoBind]);

  return <AudioContext value={controller}>{children}</AudioContext>;
}

export interface UseAudioOptions {
  /** Override controller instance instead of using context or shared fallback. */
  controller?: AudioController;
  /** Whether to automatically bind declarative attributes on mount. Defaults to true. */
  autoBind?: boolean;
}

export interface UseAudioResult extends AudioSnapshot {
  /** The underlying controller instance. */
  controller: AudioController;
  /** Play a semantic party-game sound cue. */
  play: (cue: ParlorSoundCue, options?: AudioPlayOptions) => void;
  /** Play a raw synthesized sound by name. */
  playRaw: (sound: SoundName, options?: AudioPlayOptions) => void;
  /** Set mute / enabled state. */
  setEnabled: (enabled: boolean) => void;
  /** Toggle mute state and return the new enabled value. */
  toggleMuted: () => boolean;
  /** Set global volume multiplier (0–1). */
  setVolume: (volume: number) => void;
}

/**
 * React hook for playing party-game audio cues and controlling volume/mute state.
 * Works seamlessly within an `<AudioProvider />` or with a shared singleton controller.
 */
export function useAudio(options: UseAudioOptions = {}): UseAudioResult {
  const contextController = useContext(AudioContext);
  const controller = options.controller ?? contextController ?? getSharedAudioController();

  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );

  const autoBind = options.autoBind ?? true;
  useEffect(() => {
    if (autoBind) {
      controller.bind();
    }
  }, [controller, autoBind]);

  const play = useCallback(
    (cue: ParlorSoundCue, opts?: AudioPlayOptions) => {
      controller.play(cue, opts);
    },
    [controller],
  );

  const playRaw = useCallback(
    (sound: SoundName, opts?: AudioPlayOptions) => {
      controller.playRaw(sound, opts);
    },
    [controller],
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      controller.setEnabled(enabled);
    },
    [controller],
  );

  const toggleMuted = useCallback(() => {
    return controller.toggleEnabled();
  }, [controller]);

  const setVolume = useCallback(
    (volume: number) => {
      controller.setVolume(volume);
    },
    [controller],
  );

  return {
    enabled: snapshot.enabled,
    volume: snapshot.volume,
    controller,
    play,
    playRaw,
    setEnabled,
    toggleMuted,
    setVolume,
  };
}
