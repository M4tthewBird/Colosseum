import { router } from 'expo-router';
import { ChevronDown, ChevronRight, Plus } from '@/components/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
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
import { ExercisePicker, musclesLabel } from '@/features/exercises/ExercisePicker';
import {
  addExercise,
  addSuperset,
  discardWorkout,
  finishWorkout,
  restAlert,
  type Summary,
} from '@/features/workout/actions';
import { WorkoutSummary } from '@/features/workout/WorkoutSummary';
import { ExercisePage, SupersetPage } from '@/features/workout/WorkoutPages';
import { ProgressSegment, RestPulseOverlay, useRestPulse } from '@/features/workout/WorkoutMotion';
import { formatClock } from '@/lib/dates';
import { formatRest, formatScheme } from '@/lib/formulas';
import { rpeHint } from '@/lib/periodization';
import { historyBests } from '@/lib/stats';
import { groupPlan } from '@/lib/supersets';
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

  if (summary) return <WorkoutSummary sessionId={summary.sessionId} />;
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
  const [supersetFor, setSupersetFor] = useState<number | null>(null);
  const pager = useRef<ScrollView>(null);

  const ordered = useMemo(() => [...plan].sort((a, b) => a.position - b.position), [plan]);
  const bests = useMemo(
    () => historyBests(Object.values(allSessions), session.id),
    [allSessions, session.id],
  );
  const groups = useMemo(() => groupPlan(ordered), [ordered]);
  const pages = groups.length + 1; // last page adds an exercise
  const idx = Math.min(current, pages - 1);

  const restPulse = useRestPulse();

  // Keep the pager in sync with the current exercise. `pages` is a dependency too: when an
  // exercise is added or removed the browser keeps the old page in view (scroll anchoring).
  // Scroll events caused by this (or by the browser keeping a page in view) are not swipes.
  const settling = useRef(0);
  const pagesSeen = useRef(pages);
  useEffect(() => {
    if (pageW <= 0) return;
    // A page was added or removed: jump straight there instead of animating past pages.
    const jump = pagesSeen.current !== pages;
    pagesSeen.current = pages;
    settling.current = Date.now() + 700;
    pager.current?.scrollTo({ x: idx * pageW, animated: !jump });
  }, [idx, pageW, pages]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageW || Date.now() < settling.current) return;
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

  const next = groups[idx + 1];
  const nextName = next
    ? next.map((p) => exercises[p.exercise_id]?.name ?? 'Exercise').join(' + ')
    : null;
  const groupDone = (g: PlannedExercise[]) => {
    const sets = session.sets.filter((s) => g.some((p) => p.position === s.exercise_position));
    return sets.length > 0 && sets.every((s) => s.done);
  };
  const pageProps = {
    session,
    sessions: Object.values(allSessions),
    exercises,
    bests,
    onInfo: setInfo,
    onSuperset: setSupersetFor,
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
              {groups.length > 0
                ? `${Math.min(idx + 1, groups.length)} of ${groups.length} · `
                : ''}
              <Elapsed startedAt={session.started_at} />
            </Text>
          </View>
          <FillButton label="Finish" size="sm" onPress={finish} />
        </View>

        {groups.length > 0 ? (
          <View style={styles.progress} aria-hidden>
            {groups.map((g, i) => (
              <ProgressSegment
                key={g[0].position}
                on={i <= idx || groupDone(g)}
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
        style={[{ flex: 1 }, Platform.OS === 'web' && ({ overflowAnchor: 'none' } as object)]}
        keyboardShouldPersistTaps="handled"
      >
        {groups.map((g) => (
          <ScrollView
            key={g[0].position}
            style={{ width: pageW || MAX_WIDTH }}
            contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 120 }]}
            keyboardShouldPersistTaps="handled"
          >
            {g.length > 1 ? (
              <SupersetPage group={g} {...pageProps} />
            ) : (
              <ExercisePage plan={g[0]} {...pageProps} />
            )}
          </ScrollView>
        ))}
        {/* The page spans the pager; the card is centered inside it like the exercise pages. */}
        <View style={{ width: pageW || MAX_WIDTH }}>
          <View style={styles.page}>
            <GlassCard radius={26} style={{ gap: 14 }}>
              <Text style={type.title}>
                {ordered.length ? 'Add another exercise' : 'Empty workout'}
              </Text>
              <Text style={type.caption}>Pick any exercise and log your sets.</Text>
              <FillButton label="Add exercise" icon={Plus} onPress={() => setPicker(true)} />
            </GlassCard>
          </View>
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
              onPress={() => setPicker(true)}
              style={({ pressed }) => [styles.next, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Plus size={16} color={colors.accent} strokeWidth={2.6} />
              <Text style={type.bodyStrong}>Add exercise</Text>
            </Pressable>
          )}
        </Glass>
      </View>

      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={addExercise} />
      <ExercisePicker
        visible={supersetFor !== null}
        onClose={() => setSupersetFor(null)}
        onPick={(id) => {
          if (supersetFor !== null) addSuperset(supersetFor, id);
        }}
      />
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
              {info.rpe ? `, RPE ${info.rpe} (${rpeHint(info.rpe)})` : ''}
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
});
