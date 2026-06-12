/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { vercelProtectionBypassHeaders } from '@/tests/e2e/support/vercelProtection';

describe('vercelProtectionBypassHeaders', () => {
  it('returns no headers when the automation bypass secret is unset', () => {
    expect(vercelProtectionBypassHeaders({} as NodeJS.ProcessEnv)).toEqual({});
  });

  it('sets Vercel deployment protection bypass headers when configured', () => {
    expect(
      vercelProtectionBypassHeaders({
        VERCEL_AUTOMATION_BYPASS_SECRET: ' bypass-secret ',
      })
    ).toEqual({
      'x-vercel-protection-bypass': 'bypass-secret',
      'x-vercel-set-bypass-cookie': 'true',
    });
  });

  it('allows the bypass cookie mode to be overridden', () => {
    expect(
      vercelProtectionBypassHeaders({
        VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-secret',
        VERCEL_SET_BYPASS_COOKIE: 'samesitenone',
      })
    ).toEqual({
      'x-vercel-protection-bypass': 'bypass-secret',
      'x-vercel-set-bypass-cookie': 'samesitenone',
    });
  });
});
