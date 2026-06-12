export function vercelProtectionBypassHeaders(
  env: Record<string, string | undefined> = process.env
): Record<string, string> {
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!secret) {
    return {};
  }

  return {
    'x-vercel-protection-bypass': secret,
    'x-vercel-set-bypass-cookie':
      env.VERCEL_SET_BYPASS_COOKIE?.trim() || 'true',
  };
}
