/** Mirrors tokens.css. Keep both in sync. */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  accent: '#B91C1C',
  bg: '#F2F2F7',
  text: '#1C1C1E',
  text2: '#6C6C70',
  text3: '#AEAEB2',
  placeholder: '#8E8E93',
  fill: 'rgba(118,118,128,0.12)',
  fillStrong: 'rgba(118,118,128,0.18)',
  separator: 'rgba(60,60,67,0.18)',
  success: '#16A34A',
  white: '#FFFFFF',
  glassBg: 'rgba(255,255,255,0.72)',
  glassFallback: 'rgba(255,255,255,0.92)',
  glassBorder: 'rgba(255,255,255,0.9)',
} as const;

/** Accent with alpha, e.g. accentA(0.07) for a completed set row. */
export function accentA(alpha: number): string {
  return `rgba(185,28,28,${alpha})`;
}

export const shadows = {
  glass: '0 1px 1px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.05)',
  selected: '0 2px 6px rgba(0,0,0,0.08)',
  avatar: '0 4px 14px rgba(0,0,0,0.06)',
} as const;

export const radii = {
  card: 24,
  cardLarge: 26,
  row: 22,
  pill: 999,
  input: 10,
} as const;

export const space = {
  screen: 20,
  gap: 16,
  touch: 44,
  buttonHeight: 50,
  tabBarHeight: 62,
  tabBarSide: 24,
  tabBarBottom: 28,
} as const;

export const fonts = {
  brand: 'Cinzel_700Bold',
} as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8, color: colors.text },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  section: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text },
  bodyStrong: { fontSize: 15, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, fontWeight: '400', color: colors.text2 },
  captionStrong: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  small: { fontSize: 12, fontWeight: '400', color: colors.text2 },
  tab: { fontSize: 10, fontWeight: '600' },
  wordmark: { fontFamily: fonts.brand, fontSize: 12, letterSpacing: 3, color: colors.accent },
} satisfies Record<string, TextStyle>;

/** Frosted white glass. On web it uses CSS backdrop-filter; native wraps it in a BlurView. */
export const glassStyle: ViewStyle = {
  backgroundColor: colors.glassBg,
  borderWidth: 0.5,
  borderColor: colors.glassBorder,
  boxShadow: shadows.glass,
  ...(Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      } as ViewStyle)
    : null),
};

export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };
