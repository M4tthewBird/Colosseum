import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { qrPath } from '@/lib/qr';
import { colors } from '@/theme/tokens';

/** A QR code, dark on white with the 4-module quiet zone scanners need. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const qr = useMemo(() => qrPath(value), [value]);
  const box = qr.size + 8;
  return (
    <Svg width={size} height={size} viewBox={`-4 -4 ${box} ${box}`} accessibilityLabel="QR code">
      <Rect x={-4} y={-4} width={box} height={box} fill={colors.white} />
      <Path d={qr.path} fill={colors.text} />
    </Svg>
  );
}
