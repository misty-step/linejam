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
          'text-sm font-sans font-semibold',
          {
            'text-text-muted': variant === 'default',
            'text-primary': variant === 'accent',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Label.displayName = 'Label';
