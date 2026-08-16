/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { readDeploymentId } from '@/scripts/qa/deployment-skew-receipt.mjs';

describe('deployment skew oracle', () => {
  it('returns the validated deployment receipt used to detect a rollout', async () => {
    const get = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        deployment: { id: 'deployment-next' },
      }),
    });

    const deploymentId = await readDeploymentId(
      { request: { get } },
      'https://www.linejam.app'
    );

    expect(deploymentId).toBe('deployment-next');
    expect(get).toHaveBeenCalledWith('https://www.linejam.app/api/deployment', {
      failOnStatusCode: true,
      headers: { Accept: 'application/json' },
    });
  });

  it('rejects a deployment receipt without a string identifier', async () => {
    const get = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        deployment: { id: 42 },
      }),
    });

    await expect(
      readDeploymentId({ request: { get } }, 'https://www.linejam.app')
    ).rejects.toThrow('Production returned no deployment receipt');
  });
});
