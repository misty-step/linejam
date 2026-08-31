'use client';

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '@/lib/utils';

const PHONE_MEDIA_QUERY = '(max-width: 767px)';

export interface VisualViewportRect {
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
}

export interface ClientRectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/** Unlaid-out nodes report an empty rect; treat them as in-view so the mirror stays off. */
export function isRectInVisualViewport(
  rect: ClientRectLike,
  viewport: VisualViewportRect
): boolean {
  if (rect.width === 0 && rect.height === 0) return true;

  const vTop = viewport.offsetTop;
  const vBottom = viewport.offsetTop + viewport.height;
  const vLeft = viewport.offsetLeft;
  const vRight = viewport.offsetLeft + viewport.width;

  return (
    rect.bottom > vTop &&
    rect.top < vBottom &&
    rect.right > vLeft &&
    rect.left < vRight
  );
}

function readVisualViewport(): VisualViewportRect {
  const viewport = window.visualViewport;
  if (!viewport) {
    return {
      offsetTop: 0,
      offsetLeft: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  return {
    offsetTop: viewport.offsetTop,
    offsetLeft: viewport.offsetLeft,
    width: viewport.width,
    height: viewport.height,
  };
}

const barStyle: CSSProperties = {
  bottom:
    'calc(100vh - var(--lj-visual-viewport-offset-top, 0px) - var(--lj-visual-viewport-height, 100dvh))',
};

interface StickyActionBarProps {
  watchRef: RefObject<HTMLElement | null>;
  scrollRootRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
}

/**
 * Phone-only mirror of an in-flow primary action. Visible only while that
 * action is outside the visual viewport. Watches an explicit scroller — window
 * scroll does not fire inside `overflow-y-auto` game frames.
 */
export function StickyActionBar({
  watchRef,
  scrollRootRef,
  children,
  className,
}: StickyActionBarProps) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(PHONE_MEDIA_QUERY);
    let animationFrame: number | null = null;
    let observed: HTMLElement | null = null;

    const writeStuck = () => {
      animationFrame = null;
      if (!media.matches) {
        setStuck(false);
        if (observed) observed.inert = false;
        return;
      }

      const target = watchRef.current;
      if (observed && observed !== target) observed.inert = false;
      observed = target;
      if (!target) {
        setStuck(false);
        return;
      }

      const nextStuck = !isRectInVisualViewport(
        target.getBoundingClientRect(),
        readVisualViewport()
      );
      target.inert = nextStuck;
      setStuck(nextStuck);
    };

    const scheduleWrite = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(writeStuck);
    };

    writeStuck();

    const scrollRoot = scrollRootRef.current;
    scrollRoot?.addEventListener('scroll', scheduleWrite, { passive: true });
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', scheduleWrite);
    viewport?.addEventListener('scroll', scheduleWrite);
    window.addEventListener('resize', scheduleWrite);
    media.addEventListener('change', scheduleWrite);

    return () => {
      scrollRoot?.removeEventListener('scroll', scheduleWrite);
      viewport?.removeEventListener('resize', scheduleWrite);
      viewport?.removeEventListener('scroll', scheduleWrite);
      window.removeEventListener('resize', scheduleWrite);
      media.removeEventListener('change', scheduleWrite);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (observed) observed.inert = false;
    };
  }, [watchRef, scrollRootRef]);

  if (!stuck) return null;

  return (
    <div
      role="region"
      aria-label="Continue this session"
      className={cn(
        'lj-safe-inline pointer-events-auto fixed inset-x-0 z-40 border-t-2 border-primary/20 bg-background/95 pt-3 shadow-[var(--shadow-lg)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden',
        className
      )}
      style={barStyle}
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}
