'use client';

import { useEffect } from 'react';

interface VisualViewportGeometry {
  height: number;
  offsetTop: number;
}

export interface VisualViewportMetrics {
  height: number;
  offsetTop: number;
}

export function computeVisualViewportMetrics(
  viewport: VisualViewportGeometry
): VisualViewportMetrics {
  const height = Math.max(0, Math.round(viewport.height));
  const offsetTop = Math.max(0, Math.round(viewport.offsetTop));

  return { height, offsetTop };
}

/**
 * Projects the browser's visible viewport into CSS variables. Dynamic viewport
 * units are the baseline; VisualViewport closes the iOS keyboard gap where the
 * layout viewport can remain unchanged while the visible area shrinks.
 */
export function useVisualViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let animationFrame: number | null = null;

    const writeMetrics = () => {
      animationFrame = null;
      const metrics = computeVisualViewportMetrics(
        viewport ?? { height: window.innerHeight, offsetTop: 0 }
      );

      root.style.setProperty(
        '--lj-visual-viewport-height',
        `${metrics.height}px`
      );
      root.style.setProperty(
        '--lj-visual-viewport-offset-top',
        `${metrics.offsetTop}px`
      );
    };

    const scheduleWrite = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(writeMetrics);
    };

    writeMetrics();
    viewport?.addEventListener('resize', scheduleWrite);
    viewport?.addEventListener('scroll', scheduleWrite);
    window.addEventListener('resize', scheduleWrite);
    window.addEventListener('orientationchange', scheduleWrite);

    return () => {
      viewport?.removeEventListener('resize', scheduleWrite);
      viewport?.removeEventListener('scroll', scheduleWrite);
      window.removeEventListener('resize', scheduleWrite);
      window.removeEventListener('orientationchange', scheduleWrite);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      root.style.removeProperty('--lj-visual-viewport-height');
      root.style.removeProperty('--lj-visual-viewport-offset-top');
    };
  }, []);
}
