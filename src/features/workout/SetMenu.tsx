/**
 * Options for one set: add a drop set, mark failure, remove a drop set, and log the exercise
 * per side (left and right reps).
 */
import { ArrowLeftRight, Flame, Layers, Trash2 } from '@/components/icons';
import { Text } from 'react-native';

import { ListGroup, ListRow } from '@/components/List';
import { Sheet } from '@/components/Sheet';
import type { SetEntry } from '@/lib/types';
import { useData } from '@/stores/data';
import { colors, type } from '@/theme/tokens';
import { addDropSet, removeDropSet, removeWarmup, setEachSide, toggleFailure } from './actions';

export function SetMenu({
  set,
  title,
  onClose,
}: {
  set: SetEntry | null;
  title: string;
  onClose: () => void;
}) {
  const eachSide = useData((s) => (set ? !!s.exercisePrefs[set.exercise_id]?.each_side : false));
  const run = (fn: (id: string) => void) => () => {
    if (set) fn(set.id);
    onClose();
  };
  return (
    <Sheet visible={!!set} onClose={onClose} title={title}>
      <ListGroup>
        {set?.warmup ? (
          <ListRow
            height={56}
            chevron={false}
            left={<Trash2 size={18} color={colors.text2} strokeWidth={2} />}
            title="Remove warm-up set"
            onPress={run(removeWarmup)}
          />
        ) : (
          <>
            <ListRow
              height={60}
              chevron={false}
              left={<Layers size={18} color={colors.accent} strokeWidth={2} />}
              title="Add drop set"
              subtitle="Lower the weight and keep going right away"
              onPress={run(addDropSet)}
            />
            <ListRow
              height={60}
              chevron={false}
              left={<Flame size={18} color={colors.accent} strokeWidth={2} />}
              title={set?.failure ? 'Not to failure' : 'Mark as failure'}
              subtitle="Failure holds back the next weight increase"
              onPress={run(toggleFailure)}
            />
          </>
        )}
        <ListRow
          height={60}
          chevron={false}
          left={<ArrowLeftRight size={18} color={colors.accent} strokeWidth={2} />}
          title={eachSide ? 'Log both sides together' : 'Log each side'}
          subtitle={
            eachSide
              ? 'One reps box again for this exercise'
              : 'Left and right reps, e.g. split squats'
          }
          onPress={() => {
            if (set) setEachSide(set.exercise_id, !eachSide);
            onClose();
          }}
        />
        {set?.drop_of ? (
          <ListRow
            height={56}
            chevron={false}
            left={<Trash2 size={18} color={colors.text2} strokeWidth={2} />}
            title="Remove drop set"
            onPress={run(removeDropSet)}
          />
        ) : null}
      </ListGroup>
      <Text style={[type.small, { paddingHorizontal: 6, paddingBottom: 12 }]}>
        Drop sets count towards volume but never as a PR. Warm-ups count to nothing. Per side, both
        sides count towards volume and PRs go by the weaker side.
      </Text>
    </Sheet>
  );
}
