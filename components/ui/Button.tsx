import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles - Brutalist
          'group inline-flex items-center justify-center font-medium',
          'transition-all duration-[var(--duration-fast)]', // Smooth shadow crush
          'border border-transparent', // Placeholder for border width
          'active:scale-[0.97] active:translate-y-[2px] active:shadow-none', // Tactile press
          'active:animate-[ink-ripple_0.6s_ease-out]', // Ink stamp ripple
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50 disabled:grayscale',

          // Variants
          {
            // Primary - Solid Ink Block
            'bg-[var(--color-primary)] text-[var(--color-text-inverse)] border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-hover)] hover:animate-[stamp-hover_1.6s_ease-in-out_infinite]':
              variant === 'primary',

            // Secondary - Paper Button
            'bg-[var(--color-surface)] text-[var(--color-text-primary)] border-[var(--color-border)] shadow-[var(--shadow-sm)] hover:translate-y-[-1px] hover:shadow-[var(--shadow-md)]':
              variant === 'secondary',

            // Outline - Just the lines
            'bg-transparent text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-surface)]':
              variant === 'outline',

            // Ghost - Minimal
            'text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] border-transparent':
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
        <span className="inline-block transition-transform duration-[var(--duration-fast)] group-hover:-translate-y-[1px] group-active:translate-y-[2px]">
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
