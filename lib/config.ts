/**
 * Centralized site configuration.
 * Used by metadata routes (robots.ts, sitemap.ts) and layout metadata.
 */

const DEFAULT_SITE_URL = 'https://linejam.app';

/**
 * Normalize and validate a site URL:
 * - Prepend https:// if no protocol
 * - Strip trailing slashes
 * - Fall back to default if invalid
 */
function normalizeSiteUrl(envUrl: string | undefined): string {
  if (!envUrl) return DEFAULT_SITE_URL;

  let url = envUrl.trim();

  // Prepend https:// if no protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // Strip trailing slashes
  url = url.replace(/\/+$/, '');

  // Validate by attempting to parse as URL
  try {
    new URL(url);
    return url;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const siteConfig = {
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  title: 'Linejam',
  description:
    'Pass-the-poem party game. Take turns writing lines you can barely see. Reveal the chaos together.',
  githubRepo: 'misty-step/linejam',
} as const;
