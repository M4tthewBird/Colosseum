/**
 * A badge: a laurel wreath around a disc with the badge's symbol (or, for strength clubs, the
 * lift and its weight). Always red, and it grows with the tier (level 1–5): the wreath fills
 * out, the disc turns solid red at 4, and 5 adds a ribbon and three stars. Not earned yet:
 * grey. Artwork in badgeArt.ts; pure SVG, so it scales to any size.
 */
import { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';

import type { BadgeIcon } from '@/lib/badges';

import { medallionSvg } from './badgeArt';

export function Medallion({
  icon,
  level,
  earned,
  size = 64,
  value,
}: {
  icon: BadgeIcon;
  /** 1–5: how far up its ladder the shown tier is. */
  level: number;
  earned: boolean;
  size?: number;
  /** Shown in the middle of strength clubs, e.g. 100. */
  value?: number;
}) {
  const lv = earned ? Math.max(1, Math.min(5, level)) : 0;
  const xml = useMemo(
    () => medallionSvg(icon, lv, value != null ? String(value) : '', size),
    [icon, lv, value, size],
  );
  return <SvgXml xml={xml} width={size} height={size} style={{ overflow: 'visible' }} />;
}
