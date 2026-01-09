/**
 * Centralized site configuration.
 * Used by metadata routes (robots.ts, sitemap.ts) and layout metadata.
 */
export const siteConfig = {
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://linejam.app',
  title: 'Linejam',
  description:
    'Pass-the-poem party game. Take turns writing lines you can barely see. Reveal the chaos together.',
} as const;
