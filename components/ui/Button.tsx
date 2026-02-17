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
          'rounded-md', // Uses @theme --radius-md
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
          'opacity-100', // Always fully opaque
          'disabled:pointer-events-none disabled:grayscale disabled:brightness-75',

          // Stamp animation (success celebration)
          stampAnimate && 'animate-stamp',

          // Variants - Using @theme utilities (not arbitrary values)
          // This ensures tailwind-merge handles them correctly
          {
            // Primary - Solid Ink Block (Hanko press: translate + shadow crush)
            'bg-primary text-text-inverse border-primary hover:bg-primary-hover shadow-sm active:translate-y-[2px] active:shadow-none':
              variant === 'primary',

            // Secondary - Paper Button (Washi press: scale only)
            'bg-surface text-text-primary border-border shadow-sm hover:shadow-md active:scale-[0.96]':
              variant === 'secondary',

            // Outline - Subtle background (Washi press: scale only)
            'bg-surface/10 text-text-primary border-border hover:bg-surface/20 active:scale-[0.96]':
              variant === 'outline',

            // Ghost - Minimal (Washi press: scale only)
            'bg-transparent text-text-primary hover:bg-muted border-transparent active:scale-[0.96]':
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
