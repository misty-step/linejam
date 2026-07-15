// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DeploymentSkewObserver } from '@/components/DeploymentSkewObserver';

describe('DeploymentSkewObserver', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ deployment: { id: 'current-deployment' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('offers one clear reload when the server deployment changed', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ deployment: { id: 'new-deployment' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<DeploymentSkewObserver deploymentId="old-deployment" />);

    expect(
      await screen.findByRole('status', { name: /linejam was updated/i })
    ).toHaveTextContent(/your draft is safe/i);
    expect(
      screen.getByRole('button', { name: /reload linejam/i })
    ).toBeInTheDocument();
  });

  it('reacts immediately when the framework rejects a stale action', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ deployment: { id: 'same-deployment' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<DeploymentSkewObserver deploymentId="same-deployment" />);

    act(() => {
      window.dispatchEvent(new Event('linejam:deployment-stale'));
    });

    expect(
      await screen.findByRole('button', { name: /reload linejam/i })
    ).toBeInTheDocument();
  });

  it('reloads only after the player chooses the recovery action', async () => {
    const reload = vi.fn();
    render(
      <DeploymentSkewObserver deploymentId="old-deployment" reload={reload} />
    );

    await userEvent.click(
      await screen.findByRole('button', { name: /reload linejam/i })
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the deployment matches', async () => {
    render(<DeploymentSkewObserver deploymentId="current-deployment" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole('button', { name: /reload linejam/i })
    ).not.toBeInTheDocument();
  });
});
