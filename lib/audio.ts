'use client';

import { useSyncExternalStore } from 'react';
import {
  createAudioController,
  type AudioController,
  type SoundName,
} from '@parlor/web/audio';

// Retain explicit ceremony-era choices; absence was never an explicit opt-out.
export const SOUND_MUTED_KEY = 'linejam:ceremony-muted';
const SOUND_VOLUME = 0.45;
let controller: AudioController | undefined;
let hasInteracted = false;

function readMutedPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function getController(): AudioController | undefined {
  if (globalThis.window === undefined) return undefined;
  controller ??= createAudioController({
    enabled: !readMutedPreference(),
    volume: SOUND_VOLUME,
    storage: null,
  });
  return controller;
}

const getMuted = () => !(getController()?.getSnapshot().enabled ?? true);
const getServerMuted = () => false;
const subscribe = (listener: () => void) =>
  getController()?.subscribe(listener) ?? (() => {});

export function setSoundMuted(muted: boolean): void {
  getController()?.setEnabled(!muted);
  try {
    window.localStorage.setItem(SOUND_MUTED_KEY, muted ? '1' : '0');
  } catch {
    // All controls still share the in-memory choice when storage is unavailable.
  }
}

export function playSound(sound: SoundName): void {
  // Do not queue unsolicited page-load sounds for the next gesture.
  if (
    globalThis.window === undefined ||
    !(navigator.userActivation?.hasBeenActive ?? hasInteracted)
  ) {
    return;
  }
  try {
    // The pinned Parlor audio-only export delegates to real Cuelume 0.2.2:
    // one lazy AudioContext, gesture resume, and no fetch/decode dependency.
    getController()?.playRaw(sound);
  } catch {
    // Audio is never on the critical path of a click, mutation, or error report.
  }
}

function toggleMuted(): void {
  const muted = !getMuted();
  setSoundMuted(muted);
  if (!muted) playSound('toggle');
}

export function useSound() {
  const isMuted = useSyncExternalStore(subscribe, getMuted, getServerMuted);
  return { isMuted, toggleMuted };
}

const CONTROL_SELECTOR =
  'button, a[href], input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], [role="button"], [role="switch"], [role="checkbox"], [role="tab"], [role="menuitem"]';
const ACTIVATION_SOUNDS = {
  release: true,
  toggle: true,
  page: true,
  loading: true,
  bloom: true,
  droplet: true,
} satisfies Partial<Record<SoundName, true>>;

/** One native click covers pointer, touch, Enter, Space and assistive activation. */
export function bindSoundFeedback(
  root: Document,
  audioController = getController()
): () => void {
  controller = audioController;
  let repeatingKey = false;

  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') repeatingKey = event.repeat;
  };
  const clearRepeatingKey = () => {
    repeatingKey = false;
  };
  const activate = (event: MouseEvent) => {
    if (
      !event.isTrusted ||
      event.button !== 0 ||
      event.defaultPrevented ||
      repeatingKey ||
      event.target === null
    ) {
      return;
    }
    const target =
      event.target instanceof Element
        ? event.target
        : event.target instanceof Node
          ? event.target.parentElement
          : null;
    const control = target?.closest<HTMLElement>(CONTROL_SELECTOR);
    if (
      !control ||
      control.matches(':disabled') ||
      control.closest('[inert], [aria-disabled="true"]')
    ) {
      return;
    }

    hasInteracted = true;
    const explicitSound = control.getAttribute('data-sound');
    if (explicitSound === 'none') return;
    if (explicitSound && Object.hasOwn(ACTIVATION_SOUNDS, explicitSound)) {
      // SAFETY: Own keys of ACTIVATION_SOUNDS are validated SoundName literals.
      playSound(explicitSound as SoundName);
    } else if (control.matches('a[href]')) {
      playSound('page');
    } else if (
      control.matches(
        '[aria-pressed], [aria-expanded], [role="switch"], [role="checkbox"], [role="tab"], input[type="checkbox"], input[type="radio"]'
      )
    ) {
      playSound('toggle');
    } else {
      playSound('release');
    }
  };
  const syncPreference = (event: StorageEvent) => {
    if (event.key === SOUND_MUTED_KEY || event.key === null) {
      getController()?.setEnabled(!readMutedPreference());
    }
  };

  // Capture before navigation/unmount and before a handler disables its button.
  // No pointerdown/up binding, hover binding, label parsing, or synthetic clicks.
  root.addEventListener('click', activate, true);
  root.addEventListener('keydown', keyDown, true);
  root.addEventListener('keyup', clearRepeatingKey, true);
  root.defaultView?.addEventListener('blur', clearRepeatingKey);
  root.defaultView?.addEventListener('storage', syncPreference);
  return () => {
    root.removeEventListener('click', activate, true);
    root.removeEventListener('keydown', keyDown, true);
    root.removeEventListener('keyup', clearRepeatingKey, true);
    root.defaultView?.removeEventListener('blur', clearRepeatingKey);
    root.defaultView?.removeEventListener('storage', syncPreference);
  };
}
