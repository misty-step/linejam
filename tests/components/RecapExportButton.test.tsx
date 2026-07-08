// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockTrack = vi.fn();
vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

import { RecapExportButton } from '@/components/RecapExportButton';

describe('RecapExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks the export and invokes the browser print dialog', () => {
    const printSpy = vi.fn();
    Object.defineProperty(window, 'print', {
      value: printSpy,
      configurable: true,
      writable: true,
    });

    render(<RecapExportButton poemCount={6} />);

    fireEvent.click(screen.getByRole('button', { name: /Export as PDF/i }));

    expect(mockTrack).toHaveBeenCalledWith('recap_exported', {
      method: 'print',
      poemCount: 6,
    });
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('is excluded from the printed page itself', () => {
    render(<RecapExportButton poemCount={3} />);
    expect(screen.getByRole('button', { name: /Export as PDF/i })).toHaveClass(
      'print:hidden'
    );
  });
});
