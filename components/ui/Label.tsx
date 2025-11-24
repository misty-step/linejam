import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface LabelProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: 'default' | 'accent';
}

export const Label = forwardRef<HTMLParagraphElement, LabelProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(
          'text-xs font-mono uppercase tracking-widest',
          {
            'text-[var(--color-text-muted)]': variant === 'default',
            'text-[var(--color-primary)]': variant === 'accent',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Label.displayName = 'Label';
