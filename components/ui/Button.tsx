import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
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
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-transparent font-sans font-bold leading-snug',
          'transition-colors duration-[var(--duration-fast)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          {
            'lj-button-primary': variant === 'primary',
            'lj-button-secondary': variant === 'secondary',
            'lj-button-outline': variant === 'outline',
            'lj-button-ghost': variant === 'ghost',
            'lj-button-danger': variant === 'danger',
          },
          {
            'min-h-11 px-4 py-2 text-sm': size === 'sm',
            'min-h-12 px-5 py-2.5 text-base': size === 'md',
            'min-h-13 px-6 py-3 text-lg': size === 'lg',
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
