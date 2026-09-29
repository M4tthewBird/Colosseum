import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { ListGroup, ListRow } from '@/components/List';
import { SearchField } from '@/components/SearchField';
import { Chip } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import type { Exercise } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { type } from '@/theme/tokens';

const GROUPS: Record<string, string[]> = {
  Chest: ['chest', 'upper chest'],
  Back: ['back', 'upper back', 'lower back', 'traps', 'rear delts'],
  Shoulders: ['shoulders', 'rear delts'],
  Arms: ['biceps', 'triceps', 'forearms'],
  Legs: ['quads', 'glutes', 'hamstrings', 'calves'],
  Core: ['core', 'grip'],
};

export function musclesLabel(muscles: string[]): string {
  const s = muscles.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Search, muscle filter and "Create custom exercise". */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}) {
  const exercises = useData((s) => s.exercises);
  const userId = useData((s) => s.userId);
  const saveExercise = useData((s) => s.saveExercise);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState('');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return Object.values(exercises)
      .filter((e) => !term || e.name.toLowerCase().includes(term))
      .filter((e) => !group || e.muscles.some((m) => GROUPS[group].includes(m)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, q, group]);

  const pick = (id: string) => {
    onPick(id);
    setQ('');
    onClose();
  };

  if (creating) {
    const trimmed = name.trim();
    const exists = Object.values(exercises).some(
      (e) => e.name.toLowerCase() === trimmed.toLowerCase(),
    );
    return (
      <Sheet
        visible={visible}
        onClose={() => setCreating(false)}
        title="Custom exercise"
        doneLabel="Create"
        doneDisabled={trimmed.length < 2 || exists}
        onDone={() => {
          const e: Exercise = {
            id: uuid(),
            name: trimmed,
            muscles: muscles
              .split(',')
              .map((m) => m.trim().toLowerCase())
              .filter(Boolean),
            image_key: null,
            created_by: userId,
          };
          saveExercise(e);
          setCreating(false);
          setName('');
          setMuscles('');
          pick(e.id);
        }}
      >
        <FormGroup>
          <FormField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Cable row"
            autoFocus
          />
          <FormField
            label="Muscles"
            value={muscles}
            onChangeText={setMuscles}
            placeholder="back, biceps"
            autoCapitalize="none"
          />
        </FormGroup>
        {exists ? <FieldHint text="An exercise with this name already exists." error /> : null}
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Add exercise">
      <SearchField placeholder="Search exercises" value={q} onChangeText={setQ} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <Chip label="All" selected={!group} onPress={() => setGroup(null)} />
        {Object.keys(GROUPS).map((g) => (
          <Chip
            key={g}
            label={g}
            selected={group === g}
            onPress={() => setGroup(group === g ? null : g)}
          />
        ))}
      </ScrollView>
      {list.length > 0 ? (
        <ListGroup>
          {list.map((e) => (
            <ListRow
              key={e.id}
              height={54}
              title={e.name}
              subtitle={musclesLabel(e.muscles) + (e.created_by ? ' · custom' : '')}
              chevron={false}
              right={<Plus size={18} color="#B91C1C" strokeWidth={2.4} />}
              onPress={() => pick(e.id)}
            />
          ))}
        </ListGroup>
      ) : (
        <View style={{ paddingVertical: 12 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>No exercises found.</Text>
        </View>
      )}
      <FillButton
        label="Create custom exercise"
        icon={Plus}
        onPress={() => {
          setName(q);
          setCreating(true);
        }}
      />
    </Sheet>
  );
}
