import Svg, { Path } from 'react-native-svg';

/**
 * The Colosseum, drawn like a lucide icon (24 × 24, round caps and joins), for the City tab: its
 * curved front with the broken top, a band between the tiers and arches in both.
 */
export function ColosseumIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 19.5c3 1 15 1 18 0" />
      <Path d="M3 19.5V6c2-.8 5-1.3 8-1.4" />
      <Path d="M11 4.6l2 3.4c3 .1 6 .5 8 1.2v10.3" />
      <Path d="M3 12.5c3 .9 15 .9 18 0" />
      <Path d="M6.5 20v-3a1.5 1.5 0 0 1 3 0v3.4" />
      <Path d="M14.5 20.4V17a1.5 1.5 0 0 1 3 0v3" />
      <Path d="M6.5 12.9v-2.2a1.5 1.5 0 0 1 3 0v2.4" />
    </Svg>
  );
}
