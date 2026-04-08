import type { AuthConfig } from 'convex/server';

const clerkDomain =
  process.env.CLERK_JWT_ISSUER_DOMAIN?.trim() ||
  process.env.CLERK_FRONTEND_API_URL?.trim() ||
  deriveDomainFromPublishableKey(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
  );

export default {
  providers: clerkDomain
    ? [
        {
          domain: clerkDomain,
          applicationID: 'convex',
        },
      ]
    : [],
} satisfies AuthConfig;

function deriveDomainFromPublishableKey(
  publishableKey: string | undefined
): string | undefined {
  if (!publishableKey) return undefined;

  const encodedDomain = publishableKey.split('_').at(-1);
  if (!encodedDomain) return undefined;

  try {
    const decoded = Buffer.from(encodedDomain, 'base64url')
      .toString('utf8')
      .replace(/\$+$/, '');

    if (!decoded) return undefined;
    return decoded.startsWith('https://') ? decoded : `https://${decoded}`;
  } catch {
    return undefined;
  }
}
