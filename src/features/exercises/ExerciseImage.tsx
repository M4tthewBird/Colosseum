import { Image } from 'expo-image';
import { Dumbbell } from '@/components/icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** Bundled marble-statue illustrations (16:9, light grey background). */
const IMAGES: Record<string, number> = {
  'bench-press': require('../../../assets/exercises/bench-press.jpg'),
};

/** Exercise illustration, or a neutral placeholder of the same size. */
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
  const src = imageKey ? IMAGES[imageKey] : undefined;
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
