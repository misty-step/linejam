'use client';

import QRCode from 'react-qr-code';
import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Label } from './ui/Label';

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
      console.error('Failed to copy:', err);
    }
  };

  if (!mounted) return null;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="bg-white p-4 shadow-[var(--shadow-sm)] border border-[var(--color-border)]">
        <QRCode
          value={joinUrl}
          size={160}
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          viewBox={`0 0 256 256`}
        />
      </div>
      <div className="text-center space-y-2">
        <Label>Scan to Join</Label>
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
