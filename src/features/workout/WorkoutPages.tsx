/** Pages of the active workout: one exercise, or a superset of several on one card. */
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import { Glass, GlassCard } from '@/components/Glass';
import { Flame, Info, Layers, Link, Unlink, X } from '@/components/icons';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { FavoriteButton } from '@/features/exercises/FavoriteButton';
import { musclesLabel } from '@/features/exercises/ExercisePicker';
import { dropChain, isMain, withDrops } from '@/lib/dropsets';
import { isMachine } from '@/lib/exerciseName';
import {
  formatKg,
  formatRest,
  formatScheme,
  isSideSet,
  repsText,
  roundHalf,
  type Best,
} from '@/lib/formulas';
import { lastTimeSets } from '@/lib/stats';
import { interleave, letter } from '@/lib/supersets';
import type { Exercise, Session, SetEntry } from '@/lib/types';
import { useData } from '@/stores/data';
import { confirm } from '@/stores/ui';
import type { PlannedExercise } from '@/stores/workout';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { isWork } from '@/lib/warmups';
import {
  addDropSet,
  addRound,
  addSet,
  addWarmups,
  currentSet,
  removeExercise,
  removeRound,
  removeSet,
  toggleFailure,
  unlinkSuperset,
} from './actions';
import { ExerciseNote } from './ExerciseNote';
import { MachineWeight } from './MachineWeight';
import { NextSuggestion } from './NextSuggestion';
import { SetMenu } from './SetMenu';
import { SetHeader, SetRow } from './SetRow';

interface PageProps {
  session: Session;
  sessions: Session[];
  exercises: Record<string, Exercise>;
  bests: Record<string, Best>;
  onInfo: (p: PlannedExercise) => void;
}

const lastLabel = (l?: SetEntry) => (l ? `${formatKg(l.weight_kg)} × ${repsText(l)}` : '—');

async function askRemove(p: PlannedExercise, name: string) {
  const ok = await confirm({
    title: `Remove ${name}?`,
    message: 'Its sets in this workout will be deleted.',
    confirmLabel: 'Remove',
    destructive: true,
  });
  if (ok) removeExercise(p.position);
}

function Records({ best, machine }: { best?: Best; machine?: { id: string; name: string } }) {
  return (
    <View style={styles.records}>
      <Record
        label="Heaviest"
        value={best ? `${formatKg(best.weight)} kg` : '—'}
        hint="Weight PR"
      />
      <Record
        label="Est. 1RM"
        value={best ? `≈ ${formatKg(roundHalf(best.e1rm))} kg` : '—'}
        hint="One-rep max PR"
      />
      {machine ? <MachineWeight exerciseId={machine.id} name={machine.name} /> : null}
    </View>
  );
}

const SET_HINT = 'Tap a set number for more, such as logging each side.';

/** Set menu title: "Set 2", "A2", "Drop set" or "Warm-up". */
function menuTitle(set: SetEntry | null, label?: (s: SetEntry) => string) {
  if (!set) return '';
  if (set.drop_of) return 'Drop set';
  if (set.warmup) return 'Warm-up';
  return label ? label(set) : `Set ${set.set_number}`;
}

/**
 * Drop set and failure, one tap away under the table. They act on the last done working set
 * (or the next one before any is done), named on the left.
 */
function SetActions({ sets, label }: { sets: SetEntry[]; label?: (s: SetEntry) => string }) {
  const set = currentSet(sets);
  if (!set) return null;
  const name = label ? label(set) : `Set ${set.set_number}`;
  return (
    <View style={styles.setActions}>
      <Text style={[type.small, styles.setActionsLabel]} numberOfLines={1}>
        {name}
      </Text>
      <FillButton
        label="Drop set"
        icon={Layers}
        size="sm"
        style={{ flex: 1 }}
        accessibilityLabel={`Add a drop set after ${name}`}
        onPress={() => addDropSet(set.id)}
      />
      <FillButton
        label={set.failure ? 'Failure ✓' : 'Failure'}
        icon={Flame}
        iconFill={!!set.failure}
        size="sm"
        style={{ flex: 1 }}
        accessibilityLabel={`${name} to failure`}
        accessibilityState={{ selected: !!set.failure }}
        onPress={() => toggleFailure(set.id)}
      />
    </View>
  );
}

/** One record: heaviest weight or best estimated one-rep max. */
function Record({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.record} accessibilityLabel={`${hint}: ${value}`}>
      <Text style={type.small}>{label}</Text>
      <Text style={[styles.recordValue, tabular]}>{value}</Text>
    </View>
  );
}

function scheme(p: PlannedExercise) {
  return `${formatScheme(p.sets, p.reps_min, p.reps_max)} · rest ${formatRest(p.rest_seconds)}${p.rpe ? ` · RPE ${p.rpe}` : ''}`;
}

export function ExercisePage({
  plan: p,
  session,
  sessions,
  exercises,
  bests,
  onInfo,
  onSuperset,
}: PageProps & { plan: PlannedExercise; onSuperset: (position: number) => void }) {
  const ex = exercises[p.exercise_id];
  const name = ex?.name ?? 'Exercise';
  const hasMachineWeight = useData((s) => s.exercisePrefs[p.exercise_id]?.machine_kg != null);
  const [menu, setMenu] = useState<SetEntry | null>(null);
  const sets = session.sets
    .filter((s) => s.exercise_position === p.position)
    .sort((a, b) => a.set_number - b.set_number);
  const mains = sets.filter((s) => isMain(s) && isWork(s));
  // "Last time" lines up with the working sets; warm-ups say what they are.
  const workIndex = new Map(mains.map((s, i) => [s.id, i]));
  const last = lastTimeSets(sessions, p.exercise_id, session.id);
  return (
    <>
      <GlassCard radius={26} style={styles.exCard}>
        <ExerciseImage imageKey={ex?.image_key ?? null} name={name}>
          <FavoriteButton exerciseId={p.exercise_id} name={name} variant="overlay" />
          <IconButton
            icon={Info}
            size={30}
            iconSize={15}
            accessibilityLabel="Exercise tips"
            onPress={() => onInfo(p)}
            style={styles.infoBtn}
          />
        </ExerciseImage>
        <View style={styles.exHead}>
          <Text style={styles.exName} accessibilityRole="header">
            {name}
          </Text>
          <Text style={type.caption}>
            {ex ? `${musclesLabel(ex.muscles)} · ` : ''}
            {scheme(p)}
          </Text>
        </View>
        <Records
          best={bests[p.exercise_id]}
          machine={isMachine(name) || hasMachineWeight ? { id: p.exercise_id, name } : undefined}
        />
        <NextSuggestion plan={p} name={name} session={session} sessions={sessions} />
      </GlassCard>

      <Glass radius={22} style={styles.table}>
        <SetHeader sides={sets.some(isSideSet)} />
        {withDrops(sets).map(({ set, drops }) => (
          <Fragment key={set.id}>
            <SetRow
              set={set}
              last={set.warmup ? 'Warm-up' : lastLabel(last[workIndex.get(set.id) ?? -1])}
              label={set.warmup ? 'W' : undefined}
              onMenu={setMenu}
            />
            {drops.map((d) => (
              <SetRow key={d.id} set={d} last="" onMenu={setMenu} />
            ))}
          </Fragment>
        ))}
        <View style={styles.tableActions}>
          <TextButton label="+ Add set" accent onPress={() => addSet(p.position)} />
          <TextButton label="+ Warm-up" accent onPress={() => addWarmups(p.position)} />
          {mains.length > 1 ? (
            <TextButton label="Remove set" onPress={() => removeSet(p.position)} />
          ) : null}
        </View>
        <SetActions sets={sets} />
      </Glass>
      <Text style={[type.small, { paddingHorizontal: 4 }]}>{SET_HINT}</Text>
      <SetMenu set={menu} title={menuTitle(menu)} onClose={() => setMenu(null)} />
      <FillButton
        label="Make it a superset"
        icon={Link}
        size="sm"
        onPress={() => onSuperset(p.position)}
        accessibilityHint="Pick an exercise to do right after this one, back to back"
      />
      <ExerciseNote session={session} position={p.position} exerciseId={p.exercise_id} />
      <TextButton
        label="Remove exercise"
        accent
        style={{ alignSelf: 'center' }}
        onPress={() => askRemove(p, name)}
      />
    </>
  );
}

export function SupersetPage({
  group,
  session,
  sessions,
  exercises,
  bests,
  onInfo,
  onSuperset,
}: PageProps & { group: PlannedExercise[]; onSuperset: (position: number) => void }) {
  const [menu, setMenu] = useState<SetEntry | null>(null);
  const positions = group.map((p) => p.position);
  const letterOf = new Map(positions.map((pos, i) => [pos, letter(i)]));
  const all = session.sets.filter((s) => positions.includes(s.exercise_position));
  const sets = interleave(all.filter(isMain), positions);
  const labelOf = (s: SetEntry) =>
    `${letterOf.get(s.exercise_position) ?? ''}${s.warmup ? 'W' : s.set_number}`;
  const lastBy = new Map(
    group.map((p) => [p.position, lastTimeSets(sessions, p.exercise_id, session.id)]),
  );
  const rounds = Math.max(
    0,
    ...group.map((p) => sets.filter((s) => s.exercise_position === p.position).length),
  );
  const id = group[0].superset;
  const first = exercises[group[0].exercise_id];

  return (
    <>
      <GlassCard radius={26} style={styles.exCard}>
        <ExerciseImage
          imageKey={first?.image_key ?? null}
          name={first?.name ?? 'Exercise'}
          height={150}
        >
          <View style={styles.ssBadge}>
            <Link size={13} color="#fff" strokeWidth={2.6} />
            <Text style={styles.ssBadgeText}>Superset · {group.length} exercises</Text>
          </View>
        </ExerciseImage>
        {group.map((p, i) => {
          const ex = exercises[p.exercise_id];
          const name = ex?.name ?? 'Exercise';
          const best = bests[p.exercise_id];
          return (
            <View key={p.position} style={[styles.ssRow, i > 0 && styles.ssDivider]}>
              <View style={styles.letter}>
                <Text style={styles.letterText}>{letter(i)}</Text>
              </View>
              <Pressable
                style={{ flex: 1, gap: 2 }}
                onPress={() => onInfo(p)}
                accessibilityRole="button"
              >
                <Text style={styles.ssName} accessibilityRole="header" numberOfLines={2}>
                  {name}
                </Text>
                <Text style={type.small} numberOfLines={2}>
                  {scheme(p)}
                  {best
                    ? ` · Heaviest ${formatKg(best.weight)} · 1RM ≈ ${formatKg(roundHalf(best.e1rm))}`
                    : ''}
                </Text>
              </Pressable>
              <IconButton
                icon={X}
                size={30}
                iconSize={14}
                color={colors.text2}
                accessibilityLabel={`Remove ${name}`}
                onPress={() => askRemove(p, name)}
              />
            </View>
          );
        })}
      </GlassCard>

      <Glass radius={22} style={styles.table}>
        <SetHeader sides={all.some(isSideSet)} />
        {sets.map((s) => {
          const prev = s.warmup ? undefined : lastBy.get(s.exercise_position)?.[s.set_number - 1];
          const roundEnd = s.exercise_position === positions[positions.length - 1];
          return (
            <View
              key={s.id}
              style={[{ gap: 4 }, roundEnd && s.set_number < rounds ? styles.roundGap : undefined]}
            >
              <SetRow
                set={s}
                last={s.warmup ? 'Warm-up' : lastLabel(prev)}
                label={labelOf(s)}
                onMenu={setMenu}
              />
              {dropChain(all, s.id).map((d) => (
                <SetRow key={d.id} set={d} last="" onMenu={setMenu} />
              ))}
            </View>
          );
        })}
        <View style={styles.tableActions}>
          <TextButton label="+ Add round" accent onPress={() => addRound(positions)} />
          {rounds > 1 ? (
            <TextButton label="Remove round" onPress={() => removeRound(positions)} />
          ) : null}
        </View>
        <SetActions sets={sets} label={labelOf} />
      </Glass>
      <Text style={[type.small, { paddingHorizontal: 4 }]}>
        Do one set of each, back to back. The rest timer starts after the last exercise of the
        round. {SET_HINT}
      </Text>
      <SetMenu set={menu} title={menuTitle(menu, labelOf)} onClose={() => setMenu(null)} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <FillButton
          label="Add exercise"
          icon={Link}
          size="sm"
          style={{ flex: 1 }}
          onPress={() => onSuperset(positions[positions.length - 1])}
        />
        <FillButton
          label="Unlink"
          icon={Unlink}
          size="sm"
          style={{ flex: 1 }}
          onPress={() => id && unlinkSuperset(id)}
        />
      </View>
      {group.map((p, i) => (
        <View key={p.position} style={{ gap: 4 }}>
          <Text style={[type.small, { paddingHorizontal: 6 }]}>
            {letter(i)} · {exercises[p.exercise_id]?.name ?? 'Exercise'}
          </Text>
          <ExerciseNote session={session} position={p.position} exerciseId={p.exercise_id} />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  exCard: { padding: 8, paddingBottom: 12, gap: 12 },
  infoBtn: { position: 'absolute', right: 10, top: 10 },
  exHead: { paddingHorizontal: 8, gap: 2 },
  exName: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: colors.text },
  records: { flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
  record: {
    flex: 1,
    backgroundColor: colors.fill,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  recordValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  table: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  tableActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  setActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  setActionsLabel: { width: 44 },
  ssBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
  },
  ssBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ssRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ssDivider: { borderTopWidth: 0.5, borderTopColor: colors.separator, paddingTop: 12 },
  ssName: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3, color: colors.text },
  letter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: accentA(0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { fontSize: 14, fontWeight: '800', color: colors.accent },
  roundGap: { marginBottom: 8 },
});
