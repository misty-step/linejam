'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';
import { captureError } from '../lib/error';

type RoomPanelErrorBoundaryProps = {
  roomCode: string;
  panel: string;
  children: ReactNode;
};

type RoomPanelErrorBoundaryState = {
  error: Error | null;
};

export class RoomPanelErrorBoundary extends Component<
  RoomPanelErrorBoundaryProps,
  RoomPanelErrorBoundaryState
> {
  state: RoomPanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RoomPanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, {
      operation: 'renderRoomPanel',
      roomCode: this.props.roomCode,
      panel: this.props.panel,
      componentStack: info.componentStack ?? undefined,
    });
  }

  componentDidUpdate(previousProps: RoomPanelErrorBoundaryProps) {
    if (
      this.state.error &&
      (previousProps.roomCode !== this.props.roomCode ||
        previousProps.panel !== this.props.panel)
    ) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] gap-4 p-6 text-center">
        <span className="text-[var(--color-text-primary)] text-xl">
          This room panel needs a refresh
        </span>
        <span className="text-[var(--color-text-muted)] text-sm max-w-xl">
          The room is still open, but this panel failed while syncing live data.
          Refresh the panel to rejoin the current state.
        </span>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>
    );
  }
}
