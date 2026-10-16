'use client';

import { createElement, useEffect, useRef } from 'react';

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
    element?.addEventListener('entry-close', close);
    return () => element?.removeEventListener('entry-close', close);
  }, [onClose]);
  return (
    <div ref={host} className="contents">
      {createElement('linejam-entry', { view: kind })}
    </div>
  );
}
