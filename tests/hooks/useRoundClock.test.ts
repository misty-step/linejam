// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoundClock } from '@/hooks/useRoundClock';

describe('useRoundClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports full time remaining at the start of a round', () => {
    const start = Date.now();
    const { result } = renderHook(() => useRoundClock(start, 90_000));
    expect(result.current.fractionRemaining).toBeCloseTo(1, 1);
    expect(result.current.isOvertime).toBe(false);
  });

  it('reports overtime once the window has elapsed', () => {
    const start = Date.now() - 120_000; // 2 minutes ago, window is 90s
    const { result } = renderHook(() => useRoundClock(start, 90_000));
    expect(result.current.fractionRemaining).toBe(0);
    expect(result.current.msRemaining).toBe(0);
    expect(result.current.isOvertime).toBe(true);
  });

  it('is neutral (full, not overtime) when no start time is known', () => {
    const { result } = renderHook(() => useRoundClock(undefined, 90_000));
    expect(result.current.fractionRemaining).toBe(1);
    expect(result.current.isOvertime).toBe(false);
  });

  it('reports roughly half remaining at the midpoint', () => {
    const start = Date.now() - 45_000; // halfway through a 90s window
    const { result } = renderHook(() => useRoundClock(start, 90_000));
    expect(result.current.fractionRemaining).toBeCloseTo(0.5, 1);
    expect(result.current.isOvertime).toBe(false);
  });
});
