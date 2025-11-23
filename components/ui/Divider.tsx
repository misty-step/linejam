import { SVGProps } from 'react';
import { cn } from '@/lib/utils';

interface DividerProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

export function Divider({ className, ...props }: DividerProps) {
  return (
    <div
      className={cn('flex justify-center items-center w-full py-2', className)}
    >
      <svg
        width="100%"
        height="16"
        viewBox="0 0 400 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="max-w-[200px] text-[var(--color-border)]"
        {...props}
      >
        <path
          d="M2 8C50 8 100 4 150 4C200 4 250 12 300 12C350 12 398 8 398 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="opacity-60"
        />
        <path
          d="M10 10C60 10 110 6 160 6C210 6 260 14 310 14C360 14 390 10 390 10"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="opacity-40"
        />
      </svg>
    </div>
  );
}
