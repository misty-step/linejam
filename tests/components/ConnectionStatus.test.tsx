// @vitest-environment happy-dom
import { act, render, screen, waitFor } from '@testing-library/react';
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

function connectedState() {
  return {
    hasInflightRequests: false,
    isWebSocketConnected: true,
    timeOfOldestInflightRequest: null,
    hasEverConnected: true,
    connectionCount: 1,
    connectionRetries: 0,
    inflightMutations: 0,
    inflightActions: 0,
  };
}

describe('ConnectionStatus', () => {
  beforeEach(() => {
    setOnline(true);
    mockConnectionState.mockReturnValue(connectedState());
  });

  it('stays quiet while connected and announces one reconnect transition', async () => {
    const { rerender } = render(<ConnectionStatus />);
    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();

    mockConnectionState.mockReturnValue({
      ...connectedState(),
      isWebSocketConnected: false,
    });
    rerender(<ConnectionStatus />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection interrupted. Reconnecting…'
    );

    mockConnectionState.mockReturnValue({
      ...connectedState(),
      isWebSocketConnected: false,
      connectionRetries: 2,
    });
    rerender(<ConnectionStatus />);
    expect(screen.getAllByTestId('connection-status')).toHaveLength(1);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection interrupted. Reconnecting…'
    );

    mockConnectionState.mockReturnValue(connectedState());
    rerender(<ConnectionStatus />);
    await waitFor(() =>
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'Connection restored.'
      )
    );
    rerender(<ConnectionStatus />);
    expect(screen.getAllByTestId('connection-status')).toHaveLength(1);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection restored.'
    );
  });

  it('shows the offline state immediately and announces restoration once', async () => {
    const { rerender } = render(<ConnectionStatus />);

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'You are offline. Your draft is safe'
    );

    mockConnectionState.mockReturnValue(connectedState());
    act(() => window.dispatchEvent(new Event('online')));
    rerender(<ConnectionStatus />);
    await waitFor(() =>
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'Connection restored.'
      )
    );
    rerender(<ConnectionStatus />);
    expect(screen.getAllByTestId('connection-status')).toHaveLength(1);
  });
  it('clears the restored announcement after its brief status window', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<ConnectionStatus />);
      act(() => window.dispatchEvent(new Event('offline')));
      act(() => window.dispatchEvent(new Event('online')));
      rerender(<ConnectionStatus />);
      act(() => vi.advanceTimersByTime(0));
      expect(screen.getByText('Connection restored.')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(3000));
      expect(
        screen.queryByText('Connection restored.')
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
