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
        'p-4 border text-sm rounded-[var(--radius-sm)]',
        `border-[var(--color-${variant})] bg-[var(--color-${variant})]/5 text-[var(--color-${variant})]`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
