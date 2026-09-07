// @vitest-environment happy-dom
import { useRef, type ReactNode, type RefObject } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  StickyActionBar,
  isRectInVisualViewport,
} from '@/components/ui/StickyActionBar';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

const originalVisualViewport = window.visualViewport;

function emptyRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    toJSON() {
      return {};
    },
  };
}

function rect(partial: {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
}): DOMRect {
  const left = partial.left ?? 0;
  const right = partial.right ?? 390;
  const width = partial.width ?? right - left;
  const height = partial.height ?? partial.bottom - partial.top;
  return {
    x: left,
    y: partial.top,
    top: partial.top,
    right,
    bottom: partial.bottom,
    left,
    width,
    height,
    toJSON() {
      return {};
    },
  };
}

function installVisualViewport(geometry: {
  offsetTop?: number;
  offsetLeft?: number;
  width?: number;
  height?: number;
}) {
  const viewport = {
    offsetTop: geometry.offsetTop ?? 0,
    offsetLeft: geometry.offsetLeft ?? 0,
    width: geometry.width ?? 390,
    height: geometry.height ?? 844,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
  return viewport;
}

function Harness({
  watchRef,
  scrollRootRef,
  children,
}: {
  watchRef: RefObject<HTMLElement | null>;
  scrollRootRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <StickyActionBar watchRef={watchRef} scrollRootRef={scrollRootRef}>
      {children}
    </StickyActionBar>
  );
}

describe('isRectInVisualViewport', () => {
  const viewport = {
    offsetTop: 0,
    offsetLeft: 0,
    width: 390,
    height: 844,
  };

  it('treats an unlaid-out empty rect as in view', () => {
    expect(isRectInVisualViewport(emptyRect(), viewport)).toBe(true);
  });

  it('treats a rect inside the visual viewport as in view', () => {
    expect(
      isRectInVisualViewport(
        { top: 80, right: 360, bottom: 160, left: 16, width: 344, height: 80 },
        viewport
      )
    ).toBe(true);
  });

  it('treats a rect scrolled above the visual viewport as out of view', () => {
    expect(
      isRectInVisualViewport(
        { top: -90, right: 360, bottom: -10, left: 16, width: 344, height: 80 },
        viewport
      )
    ).toBe(false);
  });

  it('accounts for a panned visual viewport offset', () => {
    expect(
      isRectInVisualViewport(
        { top: 20, right: 360, bottom: 100, left: 16, width: 344, height: 80 },
        { offsetTop: 120, offsetLeft: 0, width: 390, height: 430 }
      )
    ).toBe(false);
  });
});

describe('StickyActionBar', () => {
  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalVisualViewport,
    });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  it('stays hidden on desktop even when the watched action is offscreen', async () => {
    installMatchMedia(false);
    installVisualViewport({ height: 900 });
    const watch = document.createElement('div');
    watch.getBoundingClientRect = () =>
      rect({ top: -80, bottom: -20, height: 60 });
    const scrollRoot = document.createElement('div');

    function Case() {
      const watchRef = useRef<HTMLElement | null>(watch);
      const scrollRootRef = useRef<HTMLElement | null>(scrollRoot);
      return (
        <Harness watchRef={watchRef} scrollRootRef={scrollRootRef}>
          <button type="button">Start Next Round</button>
        </Harness>
      );
    }

    render(<Case />);

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Start Next Round' })
      ).not.toBeInTheDocument();
    });
    expect(watch.inert).toBe(false);
  });

  it('mirrors the action on a phone once it leaves the visual viewport', async () => {
    installMatchMedia(true);
    installVisualViewport({ height: 667 });
    const watch = document.createElement('div');
    watch.getBoundingClientRect = () =>
      rect({ top: -80, bottom: -20, height: 60 });
    const scrollRoot = document.createElement('div');

    function Case() {
      const watchRef = useRef<HTMLElement | null>(watch);
      const scrollRootRef = useRef<HTMLElement | null>(scrollRoot);
      return (
        <Harness watchRef={watchRef} scrollRootRef={scrollRootRef}>
          <button type="button">Start Next Round</button>
        </Harness>
      );
    }

    render(<Case />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start Next Round' })
      ).toBeInTheDocument();
    });
    expect(watch.inert).toBe(true);
    expect(
      screen.getByRole('region', { name: 'Continue this session' })
    ).toHaveClass('md:hidden');
  });

  it('listens to the inner scroller, not window', async () => {
    installMatchMedia(true);
    const viewport = installVisualViewport({ height: 667 });
    const watch = document.createElement('div');
    watch.getBoundingClientRect = () =>
      rect({ top: 80, bottom: 160, height: 80 });
    const scrollRoot = document.createElement('div');
    const add = vi.spyOn(scrollRoot, 'addEventListener');

    function Case() {
      const watchRef = useRef<HTMLElement | null>(watch);
      const scrollRootRef = useRef<HTMLElement | null>(scrollRoot);
      return (
        <Harness watchRef={watchRef} scrollRootRef={scrollRootRef}>
          <button type="button">Start Next Round</button>
        </Harness>
      );
    }

    render(<Case />);

    await waitFor(() => {
      expect(add).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        expect.objectContaining({ passive: true })
      );
    });
    expect(viewport.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );

    watch.getBoundingClientRect = () =>
      rect({ top: -80, bottom: -20, height: 60 });
    await act(async () => {
      scrollRoot.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Start Next Round' })
      ).toBeInTheDocument();
    });
  });
});
