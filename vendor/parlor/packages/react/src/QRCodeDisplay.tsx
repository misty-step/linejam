import { QRCodeSVG } from "qrcode.react";
import { type ReactNode } from "react";

export type QRCodeErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QRCodeDisplayProps {
  value: string;
  label?: string;
  caption?: ReactNode;
  size?: number;
  includeMargin?: boolean;
  level?: QRCodeErrorCorrectionLevel;
  fgColor?: string;
  bgColor?: string;
  className?: string;
}

/** Displays opaque room data as an accessible SVG QR code. */
export function QRCodeDisplay({
  value,
  label = "QR code",
  caption,
  size = 160,
  includeMargin = true,
  level = "M",
  fgColor,
  bgColor,
  className,
}: QRCodeDisplayProps) {
  const classes = ["parlor-qr-code", className].filter(Boolean).join(" ");
  const qrProps = {
    value,
    size,
    includeMargin,
    level,
    ...(fgColor === undefined ? {} : { fgColor }),
    ...(bgColor === undefined ? {} : { bgColor }),
  };

  return (
    <figure className={classes}>
      <QRCodeSVG {...qrProps} role="img" aria-label={label} />
      {caption !== undefined ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
