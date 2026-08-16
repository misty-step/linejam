// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  markPostHogReady,
  resetPostHogReady,
} from '@/lib/posthog/posthogReady';
import { RecapExportButton } from '@/components/RecapExportButton';
import * as analyticsModule from '@/lib/analytics';

describe('RecapExportButton', () => {
  let trackRecapExportedSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    markPostHogReady();
    trackRecapExportedSpy = vi
      .spyOn(analyticsModule, 'trackRecapExported')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    resetPostHogReady();
    trackRecapExportedSpy.mockRestore();
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

    expect(trackRecapExportedSpy).toHaveBeenCalledWith({
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
