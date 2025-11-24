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
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-150',
          'border border-transparent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50 disabled:grayscale',

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
