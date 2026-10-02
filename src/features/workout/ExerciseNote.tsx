import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Pencil } from '@/components/icons';
import { finished } from '@/lib/stats';
import type { Session } from '@/lib/types';
import { useData } from '@/stores/data';
import { colors, type } from '@/theme/tokens';
import { setNote } from './actions';

/** The most recent note written for this exercise in an earlier finished workout. */
export function lastNote(
  sessions: Session[],
  exerciseId: string,
  excludeId: string,
): string | null {
  for (const s of finished(sessions)) {
    if (s.id === excludeId || !s.notes) continue;
    const pos = s.sets.find((x) => x.exercise_id === exerciseId)?.exercise_position;
    const note = pos != null ? s.notes[String(pos)]?.trim() : undefined;
    if (note) return note;
  }
  return null;
}

/** Free-text note for one exercise in this workout (seat height, grip, how it felt…). */
export function ExerciseNote({
  session,
  position,
  exerciseId,
}: {
  session: Session;
  position: number;
  exerciseId: string;
}) {
  const sessions = useData((s) => s.sessions);
  const saved = session.notes?.[String(position)] ?? '';
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(false);
  const previous = lastNote(Object.values(sessions), exerciseId, session.id);

  if (!editing && !saved) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a note"
        onPress={() => setEditing(true)}
        style={({ pressed }) => [styles.add, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Pencil size={15} color={colors.accent} strokeWidth={2.2} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: colors.accent }]}>Add a note</Text>
          {previous ? (
            <Text style={type.small} numberOfLines={2}>
              Last time: {previous}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <Glass radius={18} style={styles.box}>
      <View style={styles.head}>
        <Pencil size={13} color={colors.text2} strokeWidth={2.2} />
        <Text style={type.captionStrong}>Note</Text>
      </View>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setNote(position, t);
        }}
        onBlur={() => setEditing(false)}
        autoFocus={editing}
        multiline
        maxLength={500}
        placeholder={previous ? `Last time: ${previous}` : 'Seat height, grip, how it felt…'}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel="Exercise note"
        style={styles.input}
      />
    </Glass>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 6 },
  box: { padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    fontSize: 15,
    color: colors.text,
    minHeight: 44,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as object,
});
