/**
 * After "Finish": the reward for the work. A new PR crowns the screen with the Colosseum laurel
 * (the victor's wreath) blooming in; the numbers count up; then PRs with the old record, a
 * comparison with last time, every exercise, and the week.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FillButton } from '@/components/Buttons';
import { ProgressRing, ScreenGlow } from '@/components/Charts';
import { FormField, FormGroup } from '@/components/Form';
import { Glass, GlassCard } from '@/components/Glass';
import { BookmarkPlus, Check, Flame, TrendingUp } from '@/components/icons';
import { Separator } from '@/components/List';
import { LogoMark } from '@/components/Logo';
import { MAX_WIDTH, useTopPadding } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { isSavedWorkout } from '@/features/programs/ops';
import { useActiveProgram } from '@/features/training/hooks';
import { formatDuration, isoWeekday, shortDate, weekdayName } from '@/lib/dates';
import { formatKg, formatVolume, roundHalf } from '@/lib/formulas';
import { weeklyTarget } from '@/lib/programs';
import { buildSummary, percentChange, setsLine } from '@/lib/summary';
import { useTween } from '@/lib/useTween';
import { useData } from '@/stores/data';
import { toast, useUi } from '@/stores/ui';
import { dur, ease, easeIn, useReducedMotion } from '@/theme/motion';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { saveSessionAsWorkout } from './actions';

const enter = (i: number, reduced: boolean) =>
  reduced ? undefined : FadeInDown.delay(250 + i * 90).duration(dur.layout + 80);

export function WorkoutSummary({ sessionId }: { sessionId: string }) {
  const insets = useSafeAreaInsets();
  const top = useTopPadding();
  const reduced = useReducedMotion();
  const sessions = useData((s) => s.sessions);
  const exercises = useData((s) => s.exercises);
  const programs = useData((s) => s.programs);
  const program = useActiveProgram();
  const session = sessions[sessionId];
  const [saving, setSaving] = useState(false);
  // The last set's PR toast would cover the laurel; the summary tells the story now.
  useEffect(() => useUi.getState().hideToast(), []);

  const sum = useMemo(
    () => (session ? buildSummary(session, Object.values(sessions), weeklyTarget(program)) : null),
    [session, sessions, program],
  );
  const fromSaved = useMemo(
    () =>
      !!session?.program_day_id &&
      Object.values(programs).some(
        (p) => isSavedWorkout(p) && p.days.some((d) => d.id === session.program_day_id),
      ),
    [programs, session],
  );

  const volume = useTween(sum?.volumeKg ?? 0, 900);
  const reps = useTween(sum?.reps ?? 0, 900);
  if (!session || !sum) return null;

  const d = new Date(session.started_at);
  const prCount = sum.prs.length;
  const name = (id: string) => exercises[id]?.name ?? 'Exercise';
  let i = 0;

  return (
    <View style={styles.root}>
      <ScreenGlow side="center" top={-60} opacity={prCount ? 0.2 : 0.12} fullWidth />
      <ScrollView
        contentContainerStyle={[
          styles.column,
          { paddingTop: top + 12, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.hero}>
          <Laurel celebrate={prCount > 0} />
          <Text style={[type.largeTitle, { textAlign: 'center' }]} accessibilityRole="header">
            {prCount === 0 ? 'Workout complete' : prCount === 1 ? 'New PR!' : `${prCount} new PRs!`}
          </Text>
          <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
            {session.name} · {weekdayName(isoWeekday(d))} {shortDate(d)}
          </Text>
        </View>

        <Animated.View entering={enter(i++, reduced)}>
          <GlassCard style={{ gap: 14 }}>
            <View style={styles.grid}>
              <Stat value={formatDuration(sum.durationMs)} label="Duration" />
              <Stat value={formatVolume(volume)} label="Volume" />
              <Stat value={String(sum.sets)} label="Sets" />
              <Stat value={String(Math.round(reps))} label="Reps" />
            </View>
            {sum.previous ? (
              <View style={styles.compare}>
                <TrendingUp size={15} color={colors.accent} strokeWidth={2.2} />
                <Text style={[type.small, { flex: 1 }]}>
                  Volume{' '}
                  <Text style={styles.strong}>
                    {percentChange(sum.volumeKg, sum.previous.volumeKg)}
                  </Text>{' '}
                  vs last {session.name} ({shortDate(new Date(sum.previous.date))}){' · '}
                  {formatDuration(sum.durationMs)} vs {formatDuration(sum.previous.durationMs)}
                </Text>
              </View>
            ) : (
              <Text style={type.small}>
                First time doing this workout. Next time you can beat it.
              </Text>
            )}
          </GlassCard>
        </Animated.View>

        {prCount > 0 ? (
          <Animated.View entering={enter(i++, reduced)}>
            <Glass radius={22} style={styles.card}>
              <Text style={styles.cardTitle}>Personal records</Text>
              {sum.prs.map((pr, k) => (
                <View key={pr.exerciseId}>
                  {k > 0 ? <Separator /> : null}
                  <View style={styles.prRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={type.bodyStrong}>{name(pr.exerciseId)}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {pr.kinds.weight ? <Badge text="Weight PR" /> : null}
                        {pr.kinds.e1rm ? <Badge text="1RM PR" /> : null}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={[styles.prValue, tabular]}>
                        {formatKg(pr.weight)} kg × {pr.reps}
                      </Text>
                      <Text style={[type.small, tabular]}>
                        {pr.kinds.weight
                          ? `was ${formatKg(pr.before.weight)} kg`
                          : `1RM ≈ ${formatKg(roundHalf(pr.e1rm))} kg (+${formatKg(roundHalf(pr.e1rm - pr.before.e1rm))})`}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Glass>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(i++, reduced)}>
          <Glass radius={22} style={styles.card}>
            <Text style={styles.cardTitle}>Exercises</Text>
            {sum.exercises.map((e, k) => (
              <View key={e.exerciseId + k}>
                {k > 0 ? <Separator /> : null}
                <View style={styles.exRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={type.bodyStrong} numberOfLines={1}>
                      {name(e.exerciseId)}
                    </Text>
                    <Text style={[type.small, tabular]} numberOfLines={2}>
                      {setsLine(e.sets)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[type.bodyStrong, tabular]}>{formatVolume(e.volumeKg)}</Text>
                    <Text style={[type.small, tabular]}>
                      1RM ≈ {formatKg(roundHalf(e.top.e1rm))}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Glass>
        </Animated.View>

        <Animated.View entering={enter(i++, reduced)}>
          <Glass radius={22} style={[styles.card, styles.week]}>
            <ProgressRing
              value={sum.week.target ? sum.week.done / sum.week.target : 0}
              size={56}
              stroke={6}
            >
              <Text style={[styles.ringText, tabular]}>
                {sum.week.done}/{sum.week.target}
              </Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.bodyStrong}>
                {sum.week.done >= sum.week.target
                  ? 'Weekly goal reached'
                  : `${sum.week.target - sum.week.done} more this week`}
              </Text>
              {sum.week.streak > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Flame size={14} color={colors.accent} strokeWidth={2.2} />
                  <Text style={type.small}>
                    {sum.week.streak} week{sum.week.streak === 1 ? '' : 's'} in a row
                  </Text>
                </View>
              ) : (
                <Text style={type.small}>Hit your target this week to start a streak.</Text>
              )}
            </View>
          </Glass>
        </Animated.View>

        <Animated.View entering={enter(i++, reduced)} style={{ gap: 10 }}>
          <FillButton label="Done" ready onPress={() => router.replace('/')} />
          {!fromSaved ? (
            <FillButton
              label="Save as a workout"
              icon={BookmarkPlus}
              onPress={() => setSaving(true)}
            />
          ) : null}
          <Text style={[type.small, { textAlign: 'center' }]}>
            Saved on this device. It syncs automatically when you are online.
          </Text>
        </Animated.View>
      </ScrollView>
      <SaveSheet
        visible={saving}
        initialName={session.name}
        onClose={() => setSaving(false)}
        onSave={(n) => {
          saveSessionAsWorkout(session.id, n);
          setSaving(false);
          toast('Saved to Workouts · Saved workouts');
        }}
      />
    </View>
  );
}

/** The victor's wreath: blooms in and turns into place; a soft red halo pulses once on a PR. */
function Laurel({ celebrate }: { celebrate: boolean }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  const halo = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withTiming(1, {
      duration: celebrate ? dur.focal + 200 : dur.layout + 120,
      easing: ease,
    });
    if (celebrate)
      halo.value = withDelay(
        dur.layout,
        withSequence(
          withTiming(1, { duration: dur.layout, easing: ease }),
          withTiming(0, { duration: dur.focal, easing: easeIn }),
        ),
      );
  }, [celebrate, reduced, p, halo]);
  const wreath = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.55 + 0.45 * p.value }, { rotate: `${(1 - p.value) * -24}deg` }],
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: halo.value * 0.9,
    transform: [{ scale: 0.8 + 0.5 * halo.value }],
  }));
  const size = celebrate ? 128 : 88;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {celebrate ? (
        <Animated.View
          aria-hidden
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: size / 2, backgroundColor: accentA(0.14), pointerEvents: 'none' },
            ring,
          ]}
        />
      ) : null}
      <Animated.View style={wreath}>
        <LogoMark size={size} color={celebrate ? colors.accent : colors.text3} />
      </Animated.View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: 6 }}>
      <Text style={[styles.statValue, tabular]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Check size={11} color={colors.accent} strokeWidth={3} />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function SaveSheet({
  visible,
  initialName,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Save as a workout"
      doneLabel="Save"
      onDone={() => onSave(name)}
    >
      <FormGroup>
        <FormField label="Name" value={name} onChangeText={setName} placeholder="e.g. Arms pump" />
      </FormGroup>
      <Text style={[type.caption, { paddingHorizontal: 4, paddingBottom: 12 }]}>
        Keeps these exercises, in this order, with the sets and reps you did. Start it any time from
        Workouts · Saved workouts.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  column: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  hero: { alignItems: 'center', gap: 8, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: colors.text },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strong: { color: colors.text, fontWeight: '700' },
  card: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  cardTitle: { ...type.captionStrong, paddingBottom: 2 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  prValue: { fontSize: 17, fontWeight: '700', color: colors.accent },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  week: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ringText: { fontSize: 13, fontWeight: '700', color: colors.text },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: accentA(0.1),
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },
});
