import qrcode from 'qrcode-generator';

const QUIET_ZONE = 4;

/**
 * An ISO/IEC 18004 QR symbol for `text` as inline SVG, with the 4-module
 * quiet zone the standard requires. Colors come from --qr-ink / --qr-plate.
 */
export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const size = count + QUIET_ZONE * 2;
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      // Merge horizontal runs so the path stays small and edges stay crisp.
      let run = 1;
      while (col + run < count && qr.isDark(row, col + run)) run++;
      path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h${run}v1h-${run}z`;
      col += run - 1;
    }
  }
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><rect class="qr-plate-fill" width="${size}" height="${size}"/><path class="qr-ink-fill" d="${path}"/></svg>`;
}
