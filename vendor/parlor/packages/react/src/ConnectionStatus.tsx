import { type ReactNode } from "react";

export type ConnectionState = "connected" | "connecting" | "disconnected" | "offline" | "error";

export interface ConnectionStatusProps {
  status: ConnectionState;
  label?: ReactNode;
  details?: ReactNode;
  className?: string;
}

const DEFAULT_LABELS: Record<ConnectionState, string> = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  offline: "Offline",
  error: "Connection error",
};

/** Announces connection changes without forcing visual styling on the caller. */
export function ConnectionStatus({ status, label, details, className }: ConnectionStatusProps) {
  const classes = ["parlor-connection-status", `parlor-connection-status--${status}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      data-status={status}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={status === "connecting" ? true : undefined}
    >
      <span className="parlor-connection-status__indicator" aria-hidden="true" />
      <span className="parlor-connection-status__label">{label ?? DEFAULT_LABELS[status]}</span>
      {details !== undefined ? (
        <span className="parlor-connection-status__details">{details}</span>
      ) : null}
    </div>
  );
}
