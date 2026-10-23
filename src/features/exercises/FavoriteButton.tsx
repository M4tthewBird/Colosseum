/**
 * Star to add an exercise to favorites (saved per user, synced). "overlay" sits on an exercise
 * image as a small frosted circle; "plain" is a bare star for list rows and headers.
 */
import { Pressable, StyleSheet } from 'react-native';

import { Star } from '@/components/icons';
import { useData } from '@/stores/data';
import { colors } from '@/theme/tokens';

export function FavoriteButton({
  exerciseId,
  name,
  variant = 'plain',
  size = 20,
}: {
  exerciseId: string;
  name: string;
  variant?: 'overlay' | 'plain';
  size?: number;
}) {
  const on = useData((s) => !!s.exercisePrefs[exerciseId]?.favorite);
  const toggle = useData((s) => s.toggleFavorite);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      onPress={() => toggle(exerciseId)}
      hitSlop={10}
      style={({ pressed }) => [
        variant === 'overlay' ? styles.overlay : styles.plain,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Star
        size={variant === 'overlay' ? 15 : size}
        color={on ? colors.accent : variant === 'overlay' ? colors.text : colors.text3}
        fill={on ? colors.accent : 'none'}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
});
