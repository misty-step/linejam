// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RoundClock } from '@/components/ui/RoundClock';
import { ROUND_CLOCK_MS } from '@/convex/lib/gameRules';

describe('RoundClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no round start time is known', () => {
    const { container } = render(<RoundClock roundStartedAt={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a near-full muted bar at the start of the round', () => {
    const { container } = render(<RoundClock roundStartedAt={Date.now()} />);
    const bar = container.querySelector('.h-full') as HTMLElement;
    expect(bar).toBeTruthy();
    // Early in the round the bar is wide and uses the muted (not warning) color
    expect(bar.style.width).toMatch(/9\d(\.\d+)?%|100%/);
    expect(bar.className).toContain('bg-[var(--color-text-muted)]');
  });

  it('warms to the primary color in the final stretch', () => {
    // 80% elapsed → 20% remaining (≤25% triggers warming)
    const start = Date.now() - ROUND_CLOCK_MS * 0.8;
    const { container } = render(<RoundClock roundStartedAt={start} />);
    const bar = container.querySelector('.h-full') as HTMLElement;
    expect(bar.className).toContain('bg-[var(--color-primary)]');
  });

  it('settles at full width and dimmed once overtime arrives', () => {
    const start = Date.now() - ROUND_CLOCK_MS * 2;
    const { container } = render(<RoundClock roundStartedAt={start} />);
    const bar = container.querySelector('.h-full') as HTMLElement;
    expect(bar.style.width).toBe('100%');
    expect(bar.style.opacity).toBe('0.35');
  });
});
