/** QR codes as an SVG path. Pure — covered by qr.test.ts. */
import { create } from 'qrcode/lib/core/qrcode';

/**
 * The QR code for `text` as one SVG path of unit squares (one per dark module), plus its size
 * in modules. Error correction M survives a scratched or glare-covered screen.
 */
export function qrPath(text: string): { size: number; path: string } {
  const { size, data } = create(text, { errorCorrectionLevel: 'M' }).modules;
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y * size + x]) continue;
      // Join runs of dark modules in a row into one rectangle.
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      path += `M${x} ${y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return { size, path };
}
