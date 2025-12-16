import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full bg-surface px-3 py-2',
          'text-base ring-offset-background',
          'border border-border',
          'rounded-sm shadow-sm',
          'placeholder:text-text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-150', // Standard Tailwind duration
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
