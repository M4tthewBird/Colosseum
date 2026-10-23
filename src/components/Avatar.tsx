import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { parseEmojiAvatar } from '@/lib/avatars';
import { colors } from '@/theme/tokens';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Circle with a photo, an emoji on its tone (see lib/avatars) or initials. Sizes 30 / 34 / 38 / 54 / 62. */
export function Avatar({
  name,
  url,
  size = 38,
  ring,
  white,
  style,
}: {
  name: string;
  url?: string | null;
  size?: number;
  /** Border, e.g. '2.5px accent' for 1st place. */
  ring?: { width: number; color: string };
  /** White background (podium) instead of the grey fill. */
  white?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const emoji = parseEmojiAvatar(url);
  return (
    <View
      accessibilityLabel={name}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: emoji ? emoji.tone : white ? colors.white : colors.fill,
        },
        ring && { borderWidth: ring.width, borderColor: ring.color },
        style,
      ]}
    >
      {emoji ? (
        <Text style={{ fontSize: Math.round(size * 0.52), lineHeight: Math.round(size * 0.66) }}>
          {emoji.emoji}
        </Text>
      ) : url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text style={[styles.text, { fontSize: Math.round(size * 0.33) }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { fontWeight: '600', color: colors.text },
});
