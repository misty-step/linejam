import { designTokens, type ColorMode } from '@/lib/design';

const TRANSITION_CLASS = 'mode-transitioning';
const TRANSITION_CLEANUP_MS = 300;

/** Apply the fixed Linejam identity for one effective color mode. */
export function applyColorMode(
  mode: ColorMode,
  options: { transition?: boolean } = { transition: true }
): void {
  if (globalThis.document === undefined) return;

  const root = document.documentElement;
  if (options.transition) root.classList.add(TRANSITION_CLASS);

  for (const [key, value] of Object.entries(designTokens[mode])) {
    root.style.setProperty(`--${key}`, value);
  }

  root.classList.remove('light', 'dark');
  root.classList.add(mode);

  if (options.transition) {
    setTimeout(
      () => root.classList.remove(TRANSITION_CLASS),
      TRANSITION_CLEANUP_MS
    );
  }
}

export function getAppliedColorMode(): ColorMode | null {
  if (globalThis.document === undefined) return null;

  const root = document.documentElement;
  if (root.classList.contains('dark')) return 'dark';
  if (root.classList.contains('light')) return 'light';
  return null;
}
