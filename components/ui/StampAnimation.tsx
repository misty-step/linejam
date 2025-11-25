import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StampAnimationProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

/**
 * StampAnimation - Hanko-style reveal effect
 *
 * Creates an ink stamp arrival animation: scales up from 0 with rotation
 * and a subtle ink splash effect. Used for player name reveals in lobby.
 */
export function StampAnimation({
  children,
  delay = 0,
  className,
}: StampAnimationProps) {
  return (
    <div
      className={cn('animate-stamp', className)}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {children}
    </div>
  );
}
