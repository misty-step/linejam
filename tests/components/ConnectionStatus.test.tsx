// @vitest-environment happy-dom
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexProvider } from 'convex/react';
import { createTestConvexClient } from '@/tests/helpers/convexClient';

import { ConnectionStatus } from '@/components/ConnectionStatus';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

interface ConnectionState {
  hasInflightRequests: boolean;
  isWebSocketConnected: boolean;
  timeOfOldestInflightRequest: number | null;
  hasEverConnected: boolean;
  connectionCount: number;
  connectionRetries: number;
  inflightMutations: number;
  inflightActions: number;
}

function connectedState(): ConnectionState {
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

let currentConnectionState: ConnectionState = connectedState();
const connectionListeners = new Set<() => void>();

function updateConnectionState(newState: Partial<ConnectionState>) {
  currentConnectionState = { ...currentConnectionState, ...newState };
  for (const listener of connectionListeners) {
    listener();
  }
}

const mockConvexClient = Object.assign(createTestConvexClient(), {
  connectionState: () => currentConnectionState,
  subscribeToConnectionState: (cb: () => void) => {
    connectionListeners.add(cb);
    return () => {
      connectionListeners.delete(cb);
    };
  },
  mutation: vi.fn(),
  query: vi.fn(),
  watchQuery: vi.fn(() => ({
    localQueryResult: () => undefined,
    onUpdate: () => () => {},
  })),
  setAuth: vi.fn(),
  clearAuth: vi.fn(),
});

function renderConnectionStatus() {
  return render(
    <ConvexProvider client={mockConvexClient}>
      <ConnectionStatus />
    </ConvexProvider>
  );
}

describe('ConnectionStatus', () => {
  beforeEach(() => {
    setOnline(true);
    currentConnectionState = connectedState();
    connectionListeners.clear();
  });

  it('stays quiet while connected and announces one reconnect transition', async () => {
    renderConnectionStatus();
    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();

    act(() => {
      updateConnectionState({ isWebSocketConnected: false });
    });
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection interrupted. Reconnecting…'
    );

    act(() => {
      updateConnectionState({
        isWebSocketConnected: false,
        connectionRetries: 2,
      });
    });
    expect(screen.getAllByTestId('connection-status')).toHaveLength(1);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection interrupted. Reconnecting…'
    );

    act(() => {
      updateConnectionState(connectedState());
    });
    await waitFor(() =>
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'Connection restored.'
      )
    );
    expect(screen.getAllByTestId('connection-status')).toHaveLength(1);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connection restored.'
    );
  });

  it('shows the offline state immediately and announces restoration once', async () => {
    renderConnectionStatus();

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'You are offline. Your draft is safe'
    );

    act(() => {
      updateConnectionState(connectedState());
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('connection-status')).toHaveTextContent(
        'Connection restored.'
      )
    );
    expect(screen.getAllByTestId('connection-status')).toHaveLength(1);
  });

  it('clears the restored announcement after its brief status window', () => {
    vi.useFakeTimers();
    try {
      renderConnectionStatus();
      act(() => window.dispatchEvent(new Event('offline')));
      act(() => window.dispatchEvent(new Event('online')));
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
