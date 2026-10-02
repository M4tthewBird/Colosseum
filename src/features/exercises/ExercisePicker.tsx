import { Plus } from '@/components/icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { ListGroup, ListRow } from '@/components/List';
import { SearchField } from '@/components/SearchField';
import { Chip } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { cleanExerciseName } from '@/lib/exerciseName';
import { searchExercises } from '@/lib/search';
import type { Exercise } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { accentA, colors, type } from '@/theme/tokens';

const GROUPS: Record<string, string[]> = {
  Chest: ['chest', 'upper chest'],
  Back: ['back', 'upper back', 'lower back', 'traps', 'rear delts', 'neck'],
  Shoulders: ['shoulders', 'rear delts'],
  Arms: ['biceps', 'triceps', 'forearms'],
  Legs: ['quads', 'glutes', 'hamstrings', 'calves', 'adductors', 'abductors'],
  Core: ['core', 'grip', 'hip flexors'],
  Cardio: ['cardio'],
};

const TIER_RANK = { S: 0, A: 1, B: 2 } as const;
const BROWSE_LIMIT = 80;

/** Small "S" / "A" / "B" badge: Jeff Nippard's tier list rating. */
function TierBadge({ tier }: { tier: 'S' | 'A' | 'B' }) {
  return (
    <View
      style={[styles.badge, tier === 'S' && { backgroundColor: accentA(0.12) }]}
      accessibilityLabel={`${tier} tier`}
    >
      <Text style={[styles.badgeText, tier === 'S' && { color: colors.accent }]}>{tier}</Text>
    </View>
  );
}

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
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  // Every time the picker opens it starts fresh: empty search, category "All".
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setQ('');
      setGroup(null);
      setCreating(false);
    }
  }
  const [name, setName] = useState('');
  const [muscles, setMuscles] = useState('');

  const all = useMemo(() => Object.values(exercises), [exercises]);
  const { list, total } = useMemo(() => {
    const inGroup = group
      ? all.filter((e) => e.muscles.some((m) => GROUPS[group].includes(m)))
      : all;
    if (q.trim()) return { list: searchExercises(q, inGroup, 60), total: inGroup.length };
    // Browsing: your own exercises, then the S / A / B tier picks, then everything else A–Z.
    const rank = (e: Exercise) => (e.created_by ? -1 : e.tier ? TIER_RANK[e.tier] : 3);
    const sorted = [...inGroup].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    return { list: sorted.slice(0, BROWSE_LIMIT), total: inGroup.length };
  }, [all, q, group]);

  const pick = (id: string) => {
    onPick(id);
    setQ('');
    onClose();
  };

  if (creating) {
    const trimmed = name.trim();
    const exists = Object.values(exercises).some(
      (e) => e.name.toLowerCase() === cleanExerciseName(trimmed).toLowerCase(),
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
            name: cleanExerciseName(trimmed),
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
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {e.tier ? <TierBadge tier={e.tier} /> : null}
                  <Plus size={18} color={colors.accent} strokeWidth={2.4} />
                </View>
              }
              onPress={() => pick(e.id)}
            />
          ))}
        </ListGroup>
      ) : (
        <View style={{ paddingVertical: 12 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>No exercises found.</Text>
        </View>
      )}
      {!q.trim() && total > list.length ? (
        <Text style={[type.small, { textAlign: 'center' }]}>
          Showing the top {list.length} of {total.toLocaleString('en-US')}. Type to search them all.
        </Text>
      ) : null}
      <Text style={[type.small, { textAlign: 'center' }]}>
        S / A / B = Jeff Nippard&apos;s tier list rating.
      </Text>
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

const styles = StyleSheet.create({
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 6,
    paddingHorizontal: 5,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.text2 },
});
