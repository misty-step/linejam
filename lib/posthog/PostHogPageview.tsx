'use client';

import { usePathname } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { trackPageview } from '@/lib/analytics';

function PostHogPageviewInner() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackPageview();
  }, [pathname]);

  return null;
}

export function PostHogPageview() {
  return (
    <Suspense fallback={null}>
      <PostHogPageviewInner />
    </Suspense>
  );
}
