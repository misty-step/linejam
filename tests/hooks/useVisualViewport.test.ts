// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeVisualViewportMetrics,
  useVisualViewport,
} from '@/hooks/useVisualViewport';

const originalVisualViewport = window.visualViewport;

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  });
  document.documentElement.style.removeProperty('--lj-visual-viewport-height');
  document.documentElement.style.removeProperty(
    '--lj-visual-viewport-offset-top'
  );
  vi.restoreAllMocks();
});

describe('computeVisualViewportMetrics', () => {
  it('uses the visible height and no keyboard inset at rest', () => {
    expect(computeVisualViewportMetrics({ height: 844, offsetTop: 0 })).toEqual(
      { height: 844, offsetTop: 0 }
    );
  });

  it('uses the visible height when a keyboard overlays the layout viewport', () => {
    expect(computeVisualViewportMetrics({ height: 430, offsetTop: 0 })).toEqual(
      { height: 430, offsetTop: 0 }
    );
  });

  it('accounts for a visual viewport panned below the layout top', () => {
    expect(
      computeVisualViewportMetrics({ height: 430, offsetTop: 50 })
    ).toEqual({ height: 430, offsetTop: 50 });
  });

  it('clamps impossible viewport geometry instead of emitting negative CSS', () => {
    expect(
      computeVisualViewportMetrics({ height: -20, offsetTop: -10 })
    ).toEqual({ height: 0, offsetTop: 0 });
  });

  it('falls back to the layout viewport when VisualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: undefined,
    });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(667);

    const { unmount } = renderHook(() => useVisualViewport());

    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-height'
      )
    ).toBe('667px');
    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-offset-top'
      )
    ).toBe('0px');
    unmount();
  });

  it('registers and removes every viewport listener and CSS override', () => {
    const listeners = new Map<string, EventListener>();
    const addEventListener = vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') listeners.set(type, listener);
      }
    );
    const removeEventListener = vi.fn();
    const viewport = {
      height: 430,
      offsetTop: 0,
      addEventListener,
      removeEventListener,
    };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const { unmount } = renderHook(() => useVisualViewport());

    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-height'
      )
    ).toBe('430px');
    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-offset-top'
      )
    ).toBe('0px');
    expect(addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
    expect(addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    );

    viewport.height = 360;
    viewport.offsetTop = 24;
    listeners.get('resize')?.(new Event('resize'));
    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-height'
      )
    ).toBe('360px');
    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-offset-top'
      )
    ).toBe('24px');

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    );
    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-height'
      )
    ).toBe('');
    expect(
      document.documentElement.style.getPropertyValue(
        '--lj-visual-viewport-offset-top'
      )
    ).toBe('');
  });
});
