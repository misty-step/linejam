// @vitest-environment happy-dom
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConnectionState = vi.fn();

vi.mock('convex/react', () => ({
  useConvexConnectionState: () => mockConnectionState(),
}));

import { ConnectionStatus } from '@/components/ConnectionStatus';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('ConnectionStatus', () => {
  beforeEach(() => {
    setOnline(true);
    mockConnectionState.mockReturnValue({
      hasInflightRequests: false,
      isWebSocketConnected: true,
      timeOfOldestInflightRequest: null,
      hasEverConnected: true,
      connectionCount: 1,
      connectionRetries: 0,
      inflightMutations: 0,
      inflightActions: 0,
    });
  });

  it('stays quiet while connected and announces one reconnect transition', () => {
    const { rerender } = render(<ConnectionStatus />);
    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();

    mockConnectionState.mockReturnValue({
      ...mockConnectionState(),
      isWebSocketConnected: false,
    });
    rerender(<ConnectionStatus />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection interrupted. Reconnecting…'
    );

    mockConnectionState.mockReturnValue({
      ...mockConnectionState(),
      isWebSocketConnected: false,
      connectionRetries: 2,
    });
    rerender(<ConnectionStatus />);
    expect(screen.getAllByTestId('connection-status')).toHaveLength(1);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection interrupted. Reconnecting…'
    );
  });

  it('announces offline and restored once per phase transition', () => {
    const { rerender } = render(<ConnectionStatus />);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'You are offline. Your draft is safe'
    );

    mockConnectionState.mockReturnValue({
      ...mockConnectionState(),
      isWebSocketConnected: true,
    });
    act(() => window.dispatchEvent(new Event('online')));
    rerender(<ConnectionStatus />);
    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();
  });
});
