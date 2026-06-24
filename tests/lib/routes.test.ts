import { describe, expect, it } from 'vitest';
import { isGameRoute } from '@/lib/routes';

describe('isGameRoute', () => {
  it('matches the live room route where chrome should hide', () => {
    expect(isGameRoute('/room/ABCD')).toBe(true);
  });

  it('does not match marketing or other routes', () => {
    expect(isGameRoute('/')).toBe(false);
    expect(isGameRoute('/join')).toBe(false);
    expect(isGameRoute('/me/poems')).toBe(false);
    expect(isGameRoute('/poem/abc123')).toBe(false);
    // Recap lives at /recap/[code], not under /room/, so chrome stays visible.
    expect(isGameRoute('/recap/ABCD')).toBe(false);
  });

  it('treats a null or undefined pathname as non-game', () => {
    expect(isGameRoute(null)).toBe(false);
    expect(isGameRoute(undefined)).toBe(false);
  });
});
