import { HTMLAttributes, forwardRef, ElementType } from 'react';
import { cn } from '@/lib/utils';

interface LabelProps extends HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'accent';
  as?: ElementType;
}

export const Label = forwardRef<HTMLElement, LabelProps>(
  ({ className, variant = 'default', as: Component = 'p', ...props }, ref) => {
    return (
      <Component
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
