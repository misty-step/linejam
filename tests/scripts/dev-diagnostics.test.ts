import { describe, expect, it } from 'vitest';
import {
  allowsLocalDevelopmentDiagnostics,
  type DevelopmentDiagnosticTarget,
} from '@/tests/e2e/support/devDiagnostics';

const local: DevelopmentDiagnosticTarget = {
  url: 'http://127.0.0.1:3333/recap/ZZZZ',
  deploymentEnvironment: 'development',
  localFlag: '1',
  publicLocalFlag: '1',
};

describe('development-only browser diagnostics', () => {
  it('permits only affirmed loopback development targets', () => {
    for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
      expect(
        allowsLocalDevelopmentDiagnostics({
          ...local,
          url: `http://${host}:3333/recap/ZZZZ`,
        })
      ).toBe(true);
    }
  });

  it('cannot be enabled for remote, production, preview or undeclared runtimes', () => {
    const denied: DevelopmentDiagnosticTarget[] = [
      { ...local, url: 'https://linejam.app/recap/ZZZZ' },
      { ...local, url: 'https://localhost.example.com/' },
      { ...local, url: 'http://localhost@linejam.app/' },
      { ...local, url: 'file:///tmp/linejam' },
      { ...local, deploymentEnvironment: 'production' },
      { ...local, deploymentEnvironment: 'preview' },
      { ...local, deploymentEnvironment: undefined },
      { ...local, localFlag: undefined },
      { ...local, publicLocalFlag: '0' },
    ];
    for (const target of denied)
      expect(allowsLocalDevelopmentDiagnostics(target)).toBe(false);
  });
});
