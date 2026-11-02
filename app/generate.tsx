/**
 * Generate a workout: choose what to train and how long you have (or the sets and rest yourself),
 * and the rules in lib/generator pick the exercises. The list updates as you go; swap any exercise,
 * then start or save it. "How to do this workout" is there for people new to the gym.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { Glass } from '@/components/Glass';
import { FillButton, TextButton } from '@/components/Buttons';
import { FormGroup, StepperRow } from '@/components/Form';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Play,
  Repeat,
} from '@/components/icons';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { Chip, Segmented } from '@/components/Segmented';
import { CURATED_EXERCISES } from '@/data/curated';
import type { Equipment } from '@/data/equipmentExercises';
import { ExercisePicker, musclesLabel, TierBadge } from '@/features/exercises/ExercisePicker';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { useFinishedSessions } from '@/features/training/hooks';
import { startDay } from '@/features/training/UpNextCard';
import { formatRest, formatScheme } from '@/lib/formulas';
import {
  generatedName,
  effortCue,
  equipmentAlternatives,
  focusedPlan,
  generateWorkout,
  MAX_SETS,
  planForTime,
  PRESETS,
  presetOf,
  shapeText,
  warmupExercises,
  workoutMinutes,
  type GeneratedExercise,
} from '@/lib/generator';
import { MUSCLE_GROUPS, weeklySets, type MuscleGroup } from '@/lib/muscleGroups';
import { primaryGoal } from '@/lib/repRanges';
import { similarExercises } from '@/lib/similar';
import type { ProgramDay } from '@/lib/types';
import { nowIso, uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

const TIMES = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
];

const RESTS = [
  { value: 'auto', label: 'Auto' },
  { value: '90', label: '1:30' },
  { value: '120', label: '2:00' },
  { value: '180', label: '3:00' },
];

const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'gym', label: 'Full gym' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'home', label: 'At home' },
];

const EQUIPMENT_NOTES: Record<Equipment, string | null> = {
  gym: null,
  dumbbells: 'Dumbbells and a bench. Some bodyweight exercises too.',
  bodyweight: 'Your body, a pull-up bar and dip bars. Reps go higher instead of adding weight.',
  home: 'No equipment, just your body. Reps go higher instead of adding weight. A chair and a towel looped around something solid help.',
};

const FULL_BODY = PRESETS[0].groups;

const dayOf = (name: string, list: GeneratedExercise[]): ProgramDay => ({
  id: uuid(),
  position: 0,
  name,
  weekdays: [],
  exercises: list.map((e, i) => ({ ...e, id: uuid(), position: i })),
});

export default function GenerateWorkout() {
  const profile = useData((s) => s.profile);
  const userId = useData((s) => s.userId);
  const exercises = useData((s) => s.exercises);
  const prefs = useData((s) => s.exercisePrefs);
  const saveProgram = useData((s) => s.saveProgram);
  const sessions = useFinishedSessions();
  const experience = profile?.experience ?? 'beginner';
  // New to the gym: a sensible workout is there right away.
  // ?preset=full (the guide in What's new) starts with a workout to point at.
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const [groups, setGroups] = useState<MuscleGroup[]>(
    experience === 'beginner' || preset === 'full' ? FULL_BODY : [],
  );
  const equipment = usePrefs((p) => p.generatorEquipment);
  const setEquipment = usePrefs((p) => p.setGeneratorEquipment);
  const [warmupChoice, setWarmups] = useState(true);
  // No weight to ramp up to.
  const noWeights = equipment === 'bodyweight' || equipment === 'home';
  const warmups = warmupChoice && !noWeights;
  const [minutes, setMinutes] = useState('45');
  // "Choose sets and rest myself": otherwise the sets follow from the time and the rest from the goal.
  const [custom, setCustom] = useState(false);
  const [manualSets, setManualSets] = useState(6);
  const [rest, setRest] = useState('auto');
  const [seed, setSeed] = useState(1);
  // Exercises swapped by hand, by their place in the list; any new choice above starts over.
  const [swapped, setSwapped] = useState<Record<number, string>>({});
  const [swapping, setSwapping] = useState<number | null>(null);
  // "Fewer exercises, more sets" for the same time; any new choice above starts over.
  const [focused, setFocused] = useState(false);
  const reset = () => {
    setSwapped({});
    setFocused(false);
  };

  const goal = primaryGoal(profile?.goals ?? []);
  const { generated, setsPerGroup, dropped, other } = useMemo(() => {
    const options = {
      groups,
      goal,
      experience,
      equipment,
      exercises: Object.values(exercises),
      curated: CURATED_EXERCISES,
      favorites: new Set(Object.keys(prefs).filter((id) => prefs[id]?.favorite)),
      seed,
    };
    const fixedRest = rest === 'auto' ? null : Number(rest);
    const base = custom
      ? { setsPerGroup: manualSets, restSeconds: fixedRest, groups, dropped: [] as MuscleGroup[] }
      : planForTime(options, Number(minutes), MAX_SETS[experience], warmups, fixedRest);
    const alternative = custom
      ? null
      : focusedPlan(options, Number(minutes), MAX_SETS[experience], warmups, fixedRest);
    const plan = focused && alternative ? alternative : base;
    const otherPlan = focused ? base : alternative;
    return {
      generated: generateWorkout({ ...options, ...plan }),
      setsPerGroup: plan.setsPerGroup,
      dropped: plan.dropped,
      // The plan the switch under the time would change to.
      other: otherPlan ? generateWorkout({ ...options, ...otherPlan }) : null,
    };
  }, [
    focused,
    equipment,
    groups,
    custom,
    manualSets,
    minutes,
    experience,
    rest,
    goal,
    exercises,
    prefs,
    seed,
    warmups,
  ]);
  const list = useMemo(
    () => generated.map((e, i) => (swapped[i] ? { ...e, exercise_id: swapped[i] } : e)),
    [generated, swapped],
  );
  const warmupFor = useMemo(
    () => (warmups ? warmupExercises(list, exercises) : []),
    [warmups, list, exercises],
  );
  const total = workoutMinutes(list, warmupFor.length);
  const week = useMemo(() => weeklySets(sessions, exercises), [sessions, exercises]);
  const similar = useMemo(() => {
    const target = swapping !== null ? exercises[list[swapping]?.exercise_id] : undefined;
    if (!target) return [];
    const used = new Set(list.map((e) => e.exercise_id));
    const all = Object.values(exercises);
    return (
      equipment === 'gym'
        ? similarExercises(target, all)
        : equipmentAlternatives(equipment, target, all)
    )
      .filter((e) => !used.has(e.id))
      .map((e) => ({ exerciseId: e.id, reason: `Also trains ${e.muscles[0]}` }));
  }, [swapping, list, exercises, equipment]);

  const toggle = (g: MuscleGroup) => {
    reset();
    setGroups(groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g]);
  };
  const name = generatedName(groups);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/workouts'));

  const save = () => {
    const now = nowIso();
    saveProgram({
      id: uuid(),
      owner_id: userId,
      name,
      weeks: 1,
      training_days: [],
      phases: [],
      kind: 'workout',
      is_active: false,
      started_on: null,
      created_at: now,
      updated_at: now,
      days: [dayOf(name, list)],
    });
    toast('Saved to Workouts · Saved workouts');
    close();
  };

  return (
    <Screen tabs={false} gap={14} glow="left">
      <BackLink label="Workouts" fallback="/workouts" />
      <Header above="Built from your choices" title="Generate" />

      <TourTarget id="gen-train" style={{ gap: 10 }}>
        <SectionHeader title="What do you want to train?" />
        <View style={styles.chips}>
          {PRESETS.map((p) => (
            <Chip
              key={p.name}
              label={p.name}
              selected={presetOf(groups) === p.name}
              onPress={() => {
                reset();
                setGroups(p.groups);
              }}
            />
          ))}
        </View>
        <Text style={[type.captionStrong, styles.note]}>Or choose muscles</Text>
        <View style={styles.chips}>
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} label={g} selected={groups.includes(g)} onPress={() => toggle(g)} />
          ))}
        </View>
      </TourTarget>

      <TourTarget id="gen-equipment" style={{ gap: 8 }}>
        <SectionHeader title="What do you have?" />
        <Segmented
          options={EQUIPMENT}
          value={equipment}
          onChange={(v) => {
            reset();
            setEquipment(v);
          }}
          accessibilityLabel="Equipment"
        />
        {EQUIPMENT_NOTES[equipment] ? (
          <Text style={[type.small, styles.note]}>{EQUIPMENT_NOTES[equipment]}</Text>
        ) : null}
      </TourTarget>

      {custom ? (
        <>
          <FormGroup>
            <StepperRow
              label="Sets per muscle"
              value={setsPerGroup}
              onChange={(v) => {
                reset();
                setManualSets(v);
              }}
              min={2}
              max={10}
            />
          </FormGroup>
          <Text style={[type.small, styles.note]}>
            A set is one round of an exercise. 6 sets per muscle is, for example, 2 exercises with 3
            rounds each. New to this? 4 is a good start.
          </Text>
        </>
      ) : (
        <TourTarget id="gen-time" style={{ gap: 8 }}>
          <SectionHeader title="How long do you have?" />
          <Segmented
            options={TIMES}
            value={minutes}
            onChange={(v) => {
              reset();
              setMinutes(v);
            }}
            accessibilityLabel="How long do you have"
          />
          {list.length > 0 ? (
            <Glass radius={18} style={styles.plan}>
              <Text style={type.bodyStrong}>{shapeText(list)}</Text>
              <Text style={type.small}>
                About {total} min
                {warmupFor.length ? ', warm-ups and rests included' : ', rests included'}. Built for{' '}
                {experience === 'beginner' ? 'a beginner' : `an ${experience} lifter`}.
              </Text>
              <Text style={type.small}>{effortCue(list)}</Text>
              {other ? (
                <TextButton
                  label={`${focused ? 'Back to' : 'Prefer'} ${shapeText(other)}${focused ? '' : '?'}`}
                  accent
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => {
                    setSwapped({});
                    setFocused(!focused);
                  }}
                />
              ) : null}
            </Glass>
          ) : null}
        </TourTarget>
      )}
      <View style={{ gap: 8 }}>
        <Text style={[type.captionStrong, styles.note]}>Rest between sets</Text>
        <Segmented
          options={RESTS}
          value={rest}
          onChange={(v) => {
            reset();
            setRest(v);
          }}
          accessibilityLabel="Rest between sets"
        />
        <Text style={[type.small, styles.note]}>
          {rest !== 'auto'
            ? 'Past about 1:30 muscle gain looks the same, but longer rests let you lift heavier.'
            : goal === 'endurance'
              ? 'Short rests, for your endurance goal.'
              : '3:00 on big lifts, 2:00 on small ones.'}
        </Text>
      </View>
      {noWeights ? null : (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: warmups }}
          onPress={() => {
            reset();
            setWarmups(!warmups);
          }}
          style={styles.toggle}
        >
          <View style={[styles.box, warmups && styles.boxOn]}>
            {warmups ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>Include warm-up sets</Text>
            <Text style={type.small}>
              Light sets before the first lift for legs, pushing and pulling.
            </Text>
          </View>
        </Pressable>
      )}
      <TextButton
        label={custom ? 'Go by time instead' : 'Choose sets and rest myself'}
        style={{ alignSelf: 'flex-start' }}
        onPress={() => {
          reset();
          // Starts from what the time gave, so the list does not jump.
          if (!custom) setManualSets(setsPerGroup);
          setCustom(!custom);
        }}
      />

      {list.length > 0 ? (
        <>
          <SectionHeader
            title={name}
            right={
              <TextButton
                label="Shuffle"
                accent
                onPress={() => {
                  setSwapped({});
                  setSeed(seed + 1);
                }}
              />
            }
          />
          {custom ? (
            <Text style={[type.small, styles.note]}>
              {shapeText(list)} · about {total} min. Sets so far this week:{' '}
              {MUSCLE_GROUPS.filter((g) => groups.includes(g))
                .map((g) => `${g} ${week[g]}`)
                .join(', ')}
              .
            </Text>
          ) : null}
          {dropped.length ? (
            <Text style={[type.small, styles.note]}>
              To fit the time, {dropped.join(' and ').toLowerCase()} work in the other lifts,
              without an exercise of their own.
            </Text>
          ) : null}
          {!custom && total > Number(minutes) + 5 ? (
            <Text style={[type.small, styles.note]}>
              That is more than {minutes} min even with the fewest sets. Choose fewer muscles for a
              shorter workout.
            </Text>
          ) : null}
          {!custom && total < Number(minutes) - 15 ? (
            <Text style={[type.small, styles.note]}>
              These muscles have what they need for one session. Time left? Add another muscle.
            </Text>
          ) : null}
          <TourTarget id="gen-plan">
            <ListGroup>
              {list.map((e, i) => {
                const ex = exercises[e.exercise_id];
                const exName = ex?.name ?? 'Exercise';
                return (
                  <ListRow
                    key={`${i}:${e.exercise_id}`}
                    height={60}
                    title={exName}
                    subtitle={`${formatScheme(e.sets, e.reps_min, e.reps_max)} · rest ${formatRest(e.rest_seconds)} · ${musclesLabel(ex?.muscles ?? [])}`}
                    chevron={false}
                    rightInteractive
                    right={
                      <View style={styles.rowRight}>
                        {ex?.tier ? <TierBadge tier={ex.tier} /> : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Swap ${exName}`}
                          hitSlop={10}
                          onPress={() => setSwapping(i)}
                        >
                          <Repeat size={18} color={colors.accent} strokeWidth={2.2} />
                        </Pressable>
                      </View>
                    }
                  />
                );
              })}
            </ListGroup>
          </TourTarget>
          <HowTo
            warmups={warmups}
            startOpen={experience === 'beginner'}
            effort={effortCue(list)}
            bodyweight={noWeights}
          />
          <FillButton
            label="Start workout"
            icon={Play}
            iconFill
            onPress={() => {
              close();
              startDay(dayOf(name, list), warmupFor);
            }}
          />
          <FillButton label="Save as a workout" icon={BookmarkPlus} onPress={save} />
          <Text style={[type.small, { textAlign: 'center' }]}>
            S / A / B = exercise rating, S is best.
          </Text>
        </>
      ) : (
        <Text style={[type.caption, { textAlign: 'center', paddingVertical: 16 }]}>
          Choose at least one muscle to see your workout.
        </Text>
      )}

      <ExercisePicker
        visible={swapping !== null}
        onClose={() => setSwapping(null)}
        onPick={(id) => {
          if (swapping !== null) setSwapped({ ...swapped, [swapping]: id });
        }}
        title="Swap exercise"
        pickIcon={Repeat}
        suggested={similar}
        suggestedLabel="Similar exercises"
      />
    </Screen>
  );
}

const HOW_TO = [
  {
    title: 'Read the plan',
    text: '3 × 8–12 means 3 rounds, called sets, of 8 to 12 repetitions. Rest between sets for the time shown.',
  },
  {
    title: 'Choose the weight',
    text: 'Pick a weight you can lift with control. No need to go until you cannot do another. Too easy or too hard? Change it on the next set.',
  },
  {
    title: 'Learn the movement first',
    text: 'New exercise? Start light and move slowly through the full range. Sharp pain means stop and swap the exercise.',
  },
  {
    title: 'Next time',
    text: 'Reached the top of the repetitions on every set? Add a little weight. Colosseum suggests it for you.',
  },
  {
    title: 'How often',
    text: 'Train each muscle at least twice a week. Two full-body workouts a week already bring most of the gains.',
  },
];

/** Plain-language guide: open for beginners, one tap away for everyone else. */
function HowTo({
  warmups,
  startOpen,
  effort,
  bodyweight,
}: {
  warmups: boolean;
  startOpen: boolean;
  effort: string;
  bodyweight: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <Glass radius={22} style={styles.howTo}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.howToHead}
      >
        <Text style={[type.bodyStrong, { flex: 1 }]}>How to do this workout</Text>
        <Icon size={18} color={colors.text2} strokeWidth={2.4} />
      </Pressable>
      {open ? (
        <View style={{ gap: 12, paddingTop: 4 }}>
          {warmups ? (
            <View style={{ gap: 2 }}>
              <View style={styles.howToTitle}>
                <Flame size={14} color={colors.accent} strokeWidth={2.4} />
                <Text style={type.captionStrong}>Warm up</Text>
              </View>
              <Text style={type.small}>
                Do the exercise itself with a light weight first, about half your working weight,
                then a slightly heavier set. Sets marked W do not count. First time? Tap + Warm-up
                once you know your weight.
              </Text>
            </View>
          ) : null}
          {HOW_TO.map((h) => (
            <View key={h.title} style={{ gap: 2 }}>
              <Text style={type.captionStrong}>
                {bodyweight && h.title === 'Choose the weight' ? 'Find the right level' : h.title}
              </Text>
              <Text style={type.small}>
                {h.title !== 'Choose the weight'
                  ? h.text
                  : bodyweight
                    ? `${effort} Too easy? Do more repetitions or go slower. Too hard? Swap it for an easier version.`
                    : `${effort} ${h.text}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  plan: { padding: 14, gap: 4, marginTop: 2 },
  howTo: { paddingHorizontal: 16, paddingVertical: 6 },
  howToHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  howToTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { paddingHorizontal: 4 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
