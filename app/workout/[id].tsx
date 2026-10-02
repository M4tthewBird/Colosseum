import { router } from 'expo-router';
import { ChevronDown, ChevronRight, Info, Plus } from '@/components/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import { ScreenGlow } from '@/components/Charts';
import { Glass, GlassCard } from '@/components/Glass';
import { MAX_WIDTH, useTopPadding } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import { ExercisePicker, musclesLabel } from '@/features/exercises/ExercisePicker';
import {
  addExercise,
  addSet,
  discardWorkout,
  finishWorkout,
  removeExercise,
  removeSet,
  restAlert,
  type Summary,
} from '@/features/workout/actions';
import { SetHeader, SetRow } from '@/features/workout/SetRow';
import { ProgressSegment, RestPulseOverlay, useRestPulse } from '@/features/workout/WorkoutMotion';
import { formatClock, formatDuration } from '@/lib/dates';
import { formatKg, formatRest, formatScheme, formatVolume } from '@/lib/formulas';
import { historyBests, lastTimeSets } from '@/lib/stats';
import type { Session } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { useData } from '@/stores/data';
import { confirm } from '@/stores/ui';
import { useWorkout, type PlannedExercise } from '@/stores/workout';
import { colors, tabular, type } from '@/theme/tokens';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function WorkoutScreen() {
  const sessionId = useWorkout((s) => s.sessionId);
  const session = useData((s) => (sessionId ? s.sessions[sessionId] : undefined));
  const [summary, setSummary] = useState<Summary | null>(null);

  if (summary) return <SummaryView summary={summary} />;
  if (!session || session.finished_at) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={type.bodyStrong}>No workout in progress</Text>
        <TextButton label="Back" accent onPress={() => router.replace('/')} />
      </View>
    );
  }
  return <ActiveWorkout session={session} onFinished={setSummary} />;
}

function ActiveWorkout({
  session,
  onFinished,
}: {
  session: Session;
  onFinished: (s: Summary) => void;
}) {
  const insets = useSafeAreaInsets();
  const top = useTopPadding();
  const plan = useWorkout((s) => s.plan);
  const current = useWorkout((s) => s.current);
  const setCurrent = useWorkout((s) => s.setCurrent);
  const exercises = useData((s) => s.exercises);
  const allSessions = useData((s) => s.sessions);
  const [pageW, setPageW] = useState(0);
  const [picker, setPicker] = useState(false);
  const [info, setInfo] = useState<PlannedExercise | null>(null);
  const pager = useRef<ScrollView>(null);

  const ordered = useMemo(() => [...plan].sort((a, b) => a.position - b.position), [plan]);
  const bests = useMemo(
    () => historyBests(Object.values(allSessions), session.id),
    [allSessions, session.id],
  );
  const pages = ordered.length + 1; // last page adds an exercise
  const idx = Math.min(current, pages - 1);

  const restPulse = useRestPulse();

  // Keep the pager in sync with the current exercise.
  useEffect(() => {
    if (pageW > 0) pager.current?.scrollTo({ x: idx * pageW, animated: true });
  }, [idx, pageW]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageW) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (i !== idx) setCurrent(i);
  };

  const minimize = () => {
    useWorkout.getState().setMinimized(true);
    leave();
  };

  const finish = async () => {
    const done = session.sets.filter((s) => s.done).length;
    if (done === 0) {
      const ok = await confirm({
        title: 'Discard workout?',
        message: 'No sets are marked done, so there is nothing to save.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (ok) {
        discardWorkout();
        leave();
      }
      return;
    }
    const left = session.sets.length - done;
    const ok = await confirm({
      title: 'Finish workout?',
      message:
        left > 0
          ? `${left} set${left === 1 ? '' : 's'} not marked done will be removed.`
          : undefined,
      confirmLabel: 'Finish',
    });
    if (!ok) return;
    const s = finishWorkout();
    if (s) onFinished(s);
  };

  const next = ordered[idx + 1];
  const nextName = next ? (exercises[next.exercise_id]?.name ?? 'Exercise') : null;
  const doneCount = (p: PlannedExercise) => {
    const sets = session.sets.filter((s) => s.exercise_position === p.position);
    return sets.length > 0 && sets.every((s) => s.done);
  };

  return (
    <View style={styles.root}>
      <ScreenGlow side="left" top={-120} opacity={0.12} fullWidth />
      <View style={[styles.column, { paddingTop: top }]}>
        <View style={styles.topBar}>
          <IconButton icon={ChevronDown} accessibilityLabel="Minimize workout" onPress={minimize} />
          <View style={{ alignItems: 'center', gap: 1, flex: 1 }}>
            <Text style={[type.bodyStrong, { fontSize: 17 }]} numberOfLines={1}>
              {session.name}
            </Text>
            <Text style={[type.small, tabular]}>
              {ordered.length > 0
                ? `${Math.min(idx + 1, ordered.length)} of ${ordered.length} · `
                : ''}
              <Elapsed startedAt={session.started_at} />
            </Text>
          </View>
          <FillButton label="Finish" size="sm" onPress={finish} />
        </View>

        {ordered.length > 0 ? (
          <View style={styles.progress} aria-hidden>
            {ordered.map((p, i) => (
              <ProgressSegment
                key={p.position}
                on={i <= idx || doneCount(p)}
                style={styles.segment}
              />
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setPageW(e.nativeEvent.layout.width)}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {ordered.map((p) => {
          const ex = exercises[p.exercise_id];
          const sets = session.sets
            .filter((s) => s.exercise_position === p.position)
            .sort((a, b) => a.set_number - b.set_number);
          const last = lastTimeSets(Object.values(allSessions), p.exercise_id, session.id);
          const pr = bests[p.exercise_id];
          return (
            <ScrollView
              key={p.position}
              style={{ width: pageW || MAX_WIDTH }}
              contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 120 }]}
              keyboardShouldPersistTaps="handled"
            >
              <GlassCard radius={26} style={styles.exCard}>
                <ExerciseImage imageKey={ex?.image_key ?? null} name={ex?.name ?? 'Exercise'}>
                  <IconButton
                    icon={Info}
                    size={30}
                    iconSize={15}
                    accessibilityLabel="Exercise tips"
                    onPress={() => setInfo(p)}
                    style={styles.infoBtn}
                  />
                </ExerciseImage>
                <View style={styles.exHead}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.exName} accessibilityRole="header">
                      {ex?.name ?? 'Exercise'}
                    </Text>
                    <Text style={type.caption}>
                      {ex ? musclesLabel(ex.muscles) : ''} ·{' '}
                      {formatScheme(p.sets, p.reps_min, p.reps_max)} · rest{' '}
                      {formatRest(p.rest_seconds)}
                    </Text>
                  </View>
                  {pr ? (
                    <View style={styles.prPill}>
                      <Text style={styles.prText}>PR {formatKg(pr.weight)} kg</Text>
                    </View>
                  ) : null}
                </View>
              </GlassCard>

              <Glass radius={22} style={styles.table}>
                <SetHeader />
                {sets.map((s, i) => {
                  const l = last[i];
                  return (
                    <SetRow
                      key={s.id}
                      set={s}
                      last={l ? `${formatKg(l.weight_kg)} × ${l.reps}` : '—'}
                    />
                  );
                })}
                <View style={styles.tableActions}>
                  <TextButton label="+ Add set" accent onPress={() => addSet(p.position)} />
                  {sets.length > 1 ? (
                    <TextButton label="Remove set" onPress={() => removeSet(p.position)} />
                  ) : null}
                </View>
              </Glass>
              <TextButton
                label="Remove exercise"
                style={{ alignSelf: 'center' }}
                onPress={async () => {
                  const ok = await confirm({
                    title: `Remove ${ex?.name ?? 'exercise'}?`,
                    message: 'Its sets in this workout will be deleted.',
                    confirmLabel: 'Remove',
                    destructive: true,
                  });
                  if (ok) removeExercise(p.position);
                }}
              />
            </ScrollView>
          );
        })}
        <View style={[styles.page, { width: pageW || MAX_WIDTH }]}>
          <GlassCard radius={26} style={{ gap: 14 }}>
            <Text style={type.title}>
              {ordered.length ? 'Add another exercise' : 'Empty workout'}
            </Text>
            <Text style={type.caption}>Pick any exercise and log your sets.</Text>
            <FillButton label="Add exercise" icon={Plus} onPress={() => setPicker(true)} />
          </GlassCard>
        </View>
      </ScrollView>

      <View style={[styles.floatWrap, { bottom: insets.bottom + 28 }]}>
        <Glass radius={33} style={styles.float}>
          <RestPulseOverlay style={restPulse.style} radius={33} />
          <RestReadout onFinished={restPulse.pulse} />
          {nextName ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setCurrent(idx + 1)}
              style={({ pressed }) => [styles.next, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View>
                <Text style={{ fontSize: 11, color: colors.text2 }}>Next</Text>
                <Text style={[type.bodyStrong]} numberOfLines={1}>
                  {nextName}
                </Text>
              </View>
              <ChevronRight size={14} color={colors.text} strokeWidth={2.8} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => (idx < ordered.length ? setCurrent(ordered.length) : setPicker(true))}
              style={({ pressed }) => [styles.next, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Plus size={16} color={colors.accent} strokeWidth={2.6} />
              <Text style={type.bodyStrong}>Add exercise</Text>
            </Pressable>
          )}
        </Glass>
      </View>

      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={addExercise} />
      <Sheet
        visible={!!info}
        onClose={() => setInfo(null)}
        title={info ? exercises[info.exercise_id]?.name : ''}
      >
        {info ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Text style={type.body}>
              Muscles: {musclesLabel(exercises[info.exercise_id]?.muscles ?? [])}
            </Text>
            <Text style={type.body}>
              Plan: {formatScheme(info.sets, info.reps_min, info.reps_max)}, rest{' '}
              {formatRest(info.rest_seconds)}
            </Text>
            <Text style={type.caption}>Technique tips are coming soon.</Text>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

/** The elapsed clock ticks on its own so the workout screen does not re-render every second. */
function Elapsed({ startedAt }: { startedAt: string }) {
  const now = useNow(true, 1000);
  return <>{formatClock((now - new Date(startedAt).getTime()) / 1000)}</>;
}

/** Rest countdown; alerts (vibration + bar pulse) once when it reaches zero. */
function RestReadout({ onFinished }: { onFinished: () => void }) {
  const restEndsAt = useWorkout((s) => s.restEndsAt);
  const stopRest = useWorkout((s) => s.stopRest);
  const now = useNow(!!restEndsAt, 250);
  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : null;

  useEffect(() => {
    if (restEndsAt && now >= restEndsAt) {
      stopRest();
      restAlert();
      onFinished();
    }
  }, [now, restEndsAt, stopRest, onFinished]);

  return (
    <Pressable
      style={{ flex: 1 }}
      accessibilityRole="button"
      accessibilityLabel={restLeft ? 'Skip rest' : 'Rest timer'}
      onPress={() => restLeft && stopRest()}
    >
      <Text style={type.small}>Rest</Text>
      <Text style={[styles.rest, tabular, !restLeft && { color: colors.text3 }]}>
        {restLeft ? formatClock(restLeft) : '0:00'}
      </Text>
    </Pressable>
  );
}

function SummaryView({ summary }: { summary: Summary }) {
  const top = useTopPadding();
  return (
    <View style={styles.root}>
      <ScreenGlow side="center" top={-100} fullWidth />
      <View style={[styles.column, { paddingTop: top + 40, gap: 18 }]}>
        <Text style={[type.largeTitle, { textAlign: 'center' }]} accessibilityRole="header">
          Workout saved
        </Text>
        <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
          It syncs automatically when you are online.
        </Text>
        <GlassCard style={styles.summaryGrid}>
          <SummaryStat value={formatDuration(summary.durationMs)} label="Duration" />
          <SummaryStat value={formatVolume(summary.volumeKg)} label="Volume" />
          <SummaryStat value={String(summary.sets)} label="Sets" />
          <SummaryStat value={String(summary.prs)} label="PRs" accent={summary.prs > 0} />
        </GlassCard>
        <FillButton label="Done" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

function SummaryStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={{ width: '50%', paddingVertical: 8 }}>
      <Text style={[styles.summaryValue, accent && { color: colors.accent }]}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  column: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progress: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  page: { paddingHorizontal: 20, gap: 14, maxWidth: MAX_WIDTH, alignSelf: 'center', width: '100%' },
  exCard: { padding: 8, paddingBottom: 16, gap: 14 },
  infoBtn: { position: 'absolute', right: 10, top: 10 },
  exHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 8,
  },
  exName: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: colors.text },
  prPill: {
    backgroundColor: colors.fill,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  prText: { fontSize: 12, fontWeight: '600', color: colors.text },
  table: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  tableActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  floatWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  float: {
    width: '100%',
    maxWidth: MAX_WIDTH - 32,
    height: 66,
    paddingVertical: 6,
    paddingRight: 6,
    paddingLeft: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rest: { fontSize: 20, fontWeight: '600', color: colors.accent },
  next: {
    height: 54,
    paddingLeft: 20,
    paddingRight: 18,
    borderRadius: 27,
    backgroundColor: colors.fill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 230,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: colors.text },
});
