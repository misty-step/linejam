import { vi } from 'vitest';

export function installMatchMedia(initialMatches = false) {
  let changeListener: ((event: MediaQueryListEvent) => void) | null = null;
  const mediaQuery = {
    matches: initialMatches,
    addEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          changeListener = listener;
        }
      }
    ),
    removeEventListener: vi.fn(() => {
      changeListener = null;
    }),
    dispatch(matches: boolean) {
      mediaQuery.matches = matches;
      changeListener?.({ matches } as MediaQueryListEvent);
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mediaQuery),
  });

  return mediaQuery;
}
