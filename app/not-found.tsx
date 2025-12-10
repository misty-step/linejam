import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-background)] overflow-hidden">
      {/* Texture Overlay (Grain) - localized enhancement of the global grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Abstract Ink Blur - Visual Depth */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vh] h-[60vh] bg-[var(--color-surface)] rounded-full blur-[100px] opacity-60 pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* 404: The Ink Stamp */}
        {/* Using mix-blend-multiply to simulate ink sinking into paper */}
        <div className="relative mb-8 mix-blend-multiply dark:mix-blend-normal">
          <h1 className="font-[var(--font-display)] text-[10rem] md:text-[14rem] leading-none tracking-tighter text-[var(--color-primary)] animate-stamp select-none opacity-90">
            404
          </h1>
          {/* Subtle reflection/shadow for depth */}
          <div className="absolute top-0 left-0 w-full h-full text-[10rem] md:text-[14rem] leading-none tracking-tighter text-[var(--color-primary)] blur-lg opacity-20 -z-10 transform translate-y-4">
            404
          </div>
        </div>

        {/* Minimalist Copy */}
        <div
          className="space-y-6 animate-fade-in-up"
          style={{ animationDelay: 'var(--duration-fast)' }}
        >
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-[var(--font-display)] text-[var(--color-text-primary)]">
              Page Not Found
            </h2>
            <p className="text-sm font-[var(--font-sans)] text-[var(--color-text-secondary)] tracking-wide">
              THE REQUESTED PATH IS EMPTY
            </p>
          </div>

          <div className="pt-4">
            <Link href="/">
              <Button
                variant="outline"
                size="md"
                className="bg-[var(--color-background)]/50 backdrop-blur-sm"
              >
                Return Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
