import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'error' | 'success' | 'warning' | 'info';
}

export function Alert({
  className,
  variant = 'info',
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'p-4 border text-sm rounded-sm',
        // Use theme utilities instead of arbitrary values
        // This prevents tailwind-merge from stripping color classes
        {
          'border-error bg-error/5 text-error': variant === 'error',
          'border-success bg-success/5 text-success': variant === 'success',
          'border-warning bg-warning/5 text-warning': variant === 'warning',
          'border-info bg-info/5 text-info': variant === 'info',
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
