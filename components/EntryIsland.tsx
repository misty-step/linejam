'use client';

import { createElement, useEffect, useRef } from 'react';
import { captureError } from '@/lib/error';

export function EntryIsland({
  kind,
  onClose,
}: {
  kind: 'home' | 'help' | 'help-content';
  onClose?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    const close = () => onClose?.();
    const failed = () =>
      captureError(new Error('Rust entry view failed to load'));
    element?.addEventListener('entry-close', close);
    element?.addEventListener('entry-error', failed);
    return () => {
      element?.removeEventListener('entry-close', close);
      element?.removeEventListener('entry-error', failed);
    };
  }, [onClose]);
  return (
    <div ref={host} className="contents">
      {createElement('linejam-entry', { view: kind })}
    </div>
  );
}
