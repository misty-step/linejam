import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button Component: Tactile Press Metaphors
 *
 * Strategic Design Decision (Ousterhout: Deep Module):
 * Button variants use different press mechanics to communicate material weight:
 *
 * 1. **Hanko Press** (Primary only)
 *    - Mechanism: Vertical translate + shadow crush (active:translate-y-[2px] active:shadow-none)
 *    - Metaphor: Stamping an ink seal (hanko) onto paper - firm, decisive, tactile
 *    - Why: Primary actions are commitments (submit, start game) - deserve physical weight
 *
 * 2. **Washi Compress** (Secondary, Outline, Ghost)
 *    - Mechanism: Scale compression (active:scale-[0.96])
 *    - Metaphor: Pressing rice paper (washi) - soft, yielding, gentle
 *    - Why: Secondary/utility actions are reversible - lighter touch appropriate
 *
 * Why different mechanics?
 * - Problem: Single press mechanic doesn't communicate hierarchy
 * - Tactical fix: Use color only (primary=red, secondary=white)
 * - Strategic fix: Combine color + material physics
 *
 * Result: Users feel the difference between "commit" and "navigate" actions
 * through motion, not just color. This is information hiding - we expose simple
 * variant prop, hide complex tactile feedback implementation.
 *
 * Note: Both mechanics run on 150ms (--duration-fast) - same speed, different feel.
 */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  /** Trigger hanko stamp animation (for success celebrations) */
  stampAnimate?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      stampAnimate = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles - Brutalist
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-[var(--duration-normal)]',
          'border border-transparent',
          'rounded-[var(--radius-md)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50 disabled:grayscale',

          // Stamp animation (success celebration)
          stampAnimate && 'animate-stamp',

          // Variants
          {
            // Primary - Solid Ink Block (Hanko press: translate + shadow crush)
            'bg-[var(--color-primary)] text-[var(--color-text-inverse)] border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] shadow-[var(--shadow-sm)] active:translate-y-[2px] active:shadow-none':
              variant === 'primary',

            // Secondary - Paper Button (Washi press: scale only)
            'bg-[var(--color-surface)] text-[var(--color-text-primary)] border-[var(--color-border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] active:scale-[0.96]':
              variant === 'secondary',

            // Outline - Just the lines (Washi press: scale only)
            'bg-transparent text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-surface)] active:scale-[0.96]':
              variant === 'outline',

            // Ghost - Minimal (Washi press: scale only)
            'text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] border-transparent active:scale-[0.96]':
              variant === 'ghost',
          },

          // Sizes
          {
            'h-9 px-4 text-sm': size === 'sm',
            'h-11 px-6 text-base': size === 'md',
            'h-14 px-8 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
