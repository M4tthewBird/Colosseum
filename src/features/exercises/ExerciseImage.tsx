import { Image } from 'expo-image';
import { Dumbbell } from '@/components/icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { exerciseSlug } from '@/lib/slug';

import { EXERCISE_IMAGES } from './images';

/**
 * Bundled marble-statue illustration (16:9), looked up by image_key or by the exercise name,
 * or a neutral placeholder of the same size. Add images with `npm run images`.
 */
export function ExerciseImage({
  imageKey,
  name,
  height = 188,
  children,
}: {
  imageKey: string | null;
  name: string;
  height?: number;
  children?: ReactNode;
}) {
  const src = EXERCISE_IMAGES[imageKey ?? ''] ?? EXERCISE_IMAGES[exerciseSlug(name)];
  return (
    <View style={[styles.frame, { height }]}>
      {src ? (
        <Image
          source={src}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={`Marble statue performing ${name.toLowerCase()}`}
        />
      ) : (
        <View style={styles.placeholder} aria-hidden>
          <Dumbbell size={40} color="rgba(60,60,67,0.22)" strokeWidth={1.6} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 20, backgroundColor: '#DEDDDC', overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
