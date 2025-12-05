'use client';

import QRCode from 'react-qr-code';
import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { captureError } from '@/lib/error';

/**
 * Material Metaphor: QR as Physical Paper Artifact
 *
 * Design Decision (Ousterhout: Document WHY, not WHAT):
 * QR codes are inherently printed artifacts. We treat this component as a
 * physical slip of rice paper (washi) placed on the desk, maintaining the
 * ink-on-paper metaphor regardless of theme.
 *
 * Why fixed colors?
 * - Material honesty: Paper doesn't change color based on ambient light
 * - Scan reliability: Standard black-on-white ensures 100% scanability
 * - Aesthetic consistency: Maintains Japanese Editorial Minimalism
 *
 * This is a deep module: Simple interface (roomCode), complex implementation
 * (theme-aware styling, material metaphor, scan optimization) hidden.
 */

// Paper and ink colors - semantic constants hide implementation
const PAPER_COLOR = '#faf9f7'; // Rice paper (warm white)
const INK_COLOR = '#1c1917'; // Sumi ink (warm black)

interface RoomQrProps {
  roomCode: string;
  className?: string;
}

export function RoomQr({ roomCode, className = '' }: RoomQrProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const joinUrl = mounted
    ? `${window.location.origin}/join?code=${roomCode}`
    : '';

  const handleCopy = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      captureError(err, { operation: 'clipboardCopy', joinUrl });
      // Client-side error - Sentry will capture, no need for server logger
    }
  };

  if (!mounted) return null;

  return (
    <div className={`flex flex-col items-center gap-6 ${className}`}>
      {/* QR Paper Slip - Enhanced Washi with Dark Mode Illumination */}
      <div
        className="p-6 rounded-[var(--radius-sm)]
                   border border-stone-200 dark:border-[var(--color-primary)]/30
                   shadow-[var(--shadow-md)]
                   dark:shadow-[0_0_32px_rgb(var(--shadow-color)/0.15)]"
        style={{ backgroundColor: PAPER_COLOR }}
      >
        <QRCode
          value={joinUrl}
          size={180}
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          viewBox={`0 0 256 256`}
          fgColor={INK_COLOR}
          bgColor={PAPER_COLOR}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-[var(--color-text-secondary)] font-mono uppercase tracking-wider">
          Scan to Join
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="text-xs h-8"
        >
          {copied ? 'Copied!' : 'Copy Invite Link'}
        </Button>
      </div>
    </div>
  );
}
