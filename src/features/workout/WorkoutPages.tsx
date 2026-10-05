/** Pages of the active workout: one exercise, or a superset of several on one card. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import { Glass, GlassCard } from '@/components/Glass';
import { Info, Link, Unlink, X } from '@/components/icons';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { musclesLabel } from '@/features/exercises/ExercisePicker';
import { formatKg, formatRest, formatScheme, roundHalf, type Best } from '@/lib/formulas';
import { lastTimeSets } from '@/lib/stats';
import { interleave, letter } from '@/lib/supersets';
import type { Exercise, Session } from '@/lib/types';
import { confirm } from '@/stores/ui';
import type { PlannedExercise } from '@/stores/workout';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import {
  addRound,
  addSet,
  removeExercise,
  removeRound,
  removeSet,
  unlinkSuperset,
} from './actions';
import { ExerciseNote } from './ExerciseNote';
import { SetHeader, SetRow } from './SetRow';

interface PageProps {
  session: Session;
  sessions: Session[];
  exercises: Record<string, Exercise>;
  bests: Record<string, Best>;
  onInfo: (p: PlannedExercise) => void;
}

const lastLabel = (l?: { weight_kg: number; reps: number }) =>
  l ? `${formatKg(l.weight_kg)} × ${l.reps}` : '—';

async function askRemove(p: PlannedExercise, name: string) {
  const ok = await confirm({
    title: `Remove ${name}?`,
    message: 'Its sets in this workout will be deleted.',
    confirmLabel: 'Remove',
    destructive: true,
  });
  if (ok) removeExercise(p.position);
}

function Records({ best }: { best?: Best }) {
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
  const sets = session.sets
    .filter((s) => s.exercise_position === p.position)
    .sort((a, b) => a.set_number - b.set_number);
  const last = lastTimeSets(sessions, p.exercise_id, session.id);
  return (
    <>
      <GlassCard radius={26} style={styles.exCard}>
        <ExerciseImage imageKey={ex?.image_key ?? null} name={name}>
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
        <Records best={bests[p.exercise_id]} />
      </GlassCard>

      <Glass radius={22} style={styles.table}>
        <SetHeader />
        {sets.map((s, i) => (
          <SetRow key={s.id} set={s} last={lastLabel(last[i])} />
        ))}
        <View style={styles.tableActions}>
          <TextButton label="+ Add set" accent onPress={() => addSet(p.position)} />
          {sets.length > 1 ? (
            <TextButton label="Remove set" onPress={() => removeSet(p.position)} />
          ) : null}
        </View>
      </Glass>
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
  const positions = group.map((p) => p.position);
  const letterOf = new Map(positions.map((pos, i) => [pos, letter(i)]));
  const sets = interleave(
    session.sets.filter((s) => positions.includes(s.exercise_position)),
    positions,
  );
  const lastBy = new Map(
    group.map((p) => [p.position, lastTimeSets(sessions, p.exercise_id, session.id)]),
  );
  const rounds = Math.max(
    0,
    ...group.map((p) => session.sets.filter((s) => s.exercise_position === p.position).length),
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
        <SetHeader />
        {sets.map((s) => {
          const l = letterOf.get(s.exercise_position) ?? '';
          const prev = lastBy.get(s.exercise_position)?.[s.set_number - 1];
          const roundEnd = s.exercise_position === positions[positions.length - 1];
          return (
            <View
              key={s.id}
              style={roundEnd && s.set_number < rounds ? styles.roundGap : undefined}
            >
              <SetRow set={s} last={lastLabel(prev)} label={`${l}${s.set_number}`} />
            </View>
          );
        })}
        <View style={styles.tableActions}>
          <TextButton label="+ Add round" accent onPress={() => addRound(positions)} />
          {rounds > 1 ? (
            <TextButton label="Remove round" onPress={() => removeRound(positions)} />
          ) : null}
        </View>
      </Glass>
      <Text style={[type.small, { paddingHorizontal: 4 }]}>
        Do one set of each, back to back. The rest timer starts after the last exercise of the
        round.
      </Text>

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
