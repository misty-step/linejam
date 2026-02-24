'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import posthog from 'posthog-js';
import { posthogIsReady } from './posthogReady';

function PostHogPageviewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Stable primitive — URLSearchParams object identity changes every render
  const search = searchParams.toString();

  useEffect(() => {
    // Guard: skip if posthog isn't initialized yet (first render races init)
    if (pathname && posthogIsReady()) {
      let url = window.origin + pathname;
      if (search) {
        url = url + '?' + search;
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, search]);

  return null;
}

export function PostHogPageview() {
  return (
    <Suspense fallback={null}>
      <PostHogPageviewInner />
    </Suspense>
  );
}
