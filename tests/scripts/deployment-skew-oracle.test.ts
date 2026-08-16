/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { readDeploymentId } from '@/scripts/qa/deployment-skew-oracle.mjs';

describe('deployment skew oracle', () => {
  it('returns the validated deployment receipt used to detect a rollout', async () => {
    const get = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        deployment: { id: 'deployment-next' },
      }),
    });

    const deploymentId = await readDeploymentId({ request: { get } });

    expect(deploymentId).toBe('deployment-next');
  });
});
