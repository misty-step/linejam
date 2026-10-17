'use client';

import { createElement, useEffect, useRef } from 'react';
import { captureError } from '@/lib/error';

export interface EntrySubmission {
  code: string;
  displayName: string;
  avatarId: string;
  resolve(feedback: string): void;
}

export function EntryIsland({
  kind,
  onClose,
  onSubmit,
  onChange,
  code,
  ready,
  value,
  disabled,
}: {
  kind: 'home' | 'help' | 'help-content' | 'join' | 'avatar-picker';
  onClose?: () => void;
  onSubmit?: (submission: EntrySubmission) => void;
  onChange?: (value: string) => void;
  code?: string;
  ready?: boolean;
  value?: string;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    const close = () => onClose?.();
    const submit = (event: Event) => {
      if (!onSubmit || !(event instanceof CustomEvent)) return;
      event.preventDefault();
      // SAFETY: entry-island.js constructs this private event from mount_join's
      // three string arguments and its Promise resolver; no credentials cross it.
      onSubmit(event.detail as EntrySubmission);
    };
    const change = (event: Event) => {
      if (event instanceof CustomEvent) onChange?.(String(event.detail));
    };
    const failed = () =>
      captureError(new Error('Rust entry view failed to load'));
    element?.addEventListener('entry-close', close);
    element?.addEventListener('entry-error', failed);
    element?.addEventListener('entry-submit', submit);
    element?.addEventListener('entry-change', change);
    return () => {
      element?.removeEventListener('entry-close', close);
      element?.removeEventListener('entry-error', failed);
      element?.removeEventListener('entry-submit', submit);
      element?.removeEventListener('entry-change', change);
    };
  }, [onClose, onSubmit, onChange]);
  return (
    <div ref={host} className="contents">
      {createElement('linejam-entry', {
        view: kind,
        code,
        ready: String(ready ?? false),
        value,
        disabled: disabled ? '' : undefined,
      })}
    </div>
  );
}
