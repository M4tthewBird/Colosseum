import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, Check, Equal, Link, Plus, Search, Trash2 } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { FieldLabel, FormField, FormGroup, StepperRow } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { ListRow, Separator } from '@/components/List';
import { move, ReorderList } from '@/components/ReorderList';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ExercisePicker, musclesLabel, TierBadge } from '@/features/exercises/ExercisePicker';
import {
  blankDay,
  blankProgram,
  blankSavedWorkout,
  isSavedWorkout,
  normalizeProgram,
} from '@/features/programs/ops';
import { weekdayName } from '@/lib/dates';
import { formatRest, formatScheme } from '@/lib/formulas';
import { resizePhases } from '@/lib/periodization';
import { instantiateTemplate, TEMPLATES } from '@/features/programs/templates';
import { similarExercises } from '@/lib/similar';
import { cleanSupersets, linkWithAbove, supersetLetters } from '@/lib/supersets';
import { weekdaysLabel } from '@/lib/programs';
import { PhaseEditor } from '@/features/programs/PhaseEditor';
import {
  GOAL_LABELS,
  GOAL_NOTES,
  orderedGoals,
  primaryGoal,
  recommend,
  type Recommendation,
} from '@/lib/repRanges';
import type { Exercise, Goal, Program, ProgramDay, ProgramExercise } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';
import { confirm, toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

const ROW_H = 54;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/workouts/programs');
}

export default function ProgramEditor() {
  const { id, kind, template } = useLocalSearchParams<{
    id: string;
    kind?: string;
    /** Start from a built-in template; saving makes it the active program. */
    template?: string;
  }>();
  const existing = useData((s) => (id && id !== 'new' ? s.programs[id] : undefined));
  const userId = useData((s) => s.userId);
  const exercises = useData((s) => s.exercises);
  const saveProgram = useData((s) => s.saveProgram);
  const setActive = useData((s) => s.setActiveProgram);
  const goals = useData((s) => s.profile?.goals ?? []);

  const fromTemplate = !existing ? TEMPLATES.find((t) => t.key === template) : undefined;
  const initial = useMemo(
    () =>
      existing ??
      (fromTemplate
        ? instantiateTemplate(fromTemplate, userId, useData.getState().exercises)
        : kind === 'workout'
          ? blankSavedWorkout(userId)
          : blankProgram(userId)),
    [existing, userId, kind, fromTemplate],
  );
  const single = isSavedWorkout(initial);
  const what = single ? 'workout' : 'program';
  const [draft, setDraft] = useState<Program>(initial);
  const [open, setOpen] = useState<string | null>(initial.days[0]?.id ?? null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  // `origin`: the exercise the sheet was first opened for, kept across a swap.
  type Editing = { dayId: string; ex: ProgramExercise; origin?: string };
  const [editing, setEditing] = useState<Editing | null>(null);
  const [swapping, setSwapping] = useState<Editing | null>(null);

  const editingList = editing
    ? draft.days.find((d) => d.id === editing.dayId)?.exercises
    : undefined;
  const editingIndex = editingList?.findIndex((e) => e.id === editing?.ex.id) ?? -1;
  const above = editingIndex > 0 ? editingList?.[editingIndex - 1] : undefined;

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const isNew = !existing;

  const patchDay = (dayId: string, fn: (d: ProgramDay) => ProgramDay) =>
    setDraft((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? fn(d) : d)) }));

  const toggleTrainingDay = (wd: number) =>
    setDraft((p) => {
      const on = p.training_days.includes(wd);
      return {
        ...p,
        training_days: on ? p.training_days.filter((x) => x !== wd) : [...p.training_days, wd],
        // A weekday that is no longer a training day is unassigned from the workout days.
        days: on
          ? p.days.map((d) => ({ ...d, weekdays: d.weekdays.filter((x) => x !== wd) }))
          : p.days,
      };
    });

  const cancel = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard changes?',
        message: `Your changes to this ${what} are not saved.`,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
      });
      if (!ok) return;
    }
    close();
  };

  const save = () => {
    if (!draft.name.trim()) {
      toast(`Give the ${what} a name`);
      return;
    }
    // A saved workout's single day carries the workout's name.
    const p = normalizeProgram(
      single
        ? {
            ...draft,
            days: draft.days.map((d) => ({ ...d, name: draft.name.trim(), weekdays: [] })),
          }
        : draft,
    );
    saveProgram(p);
    const hasActive = Object.values(useData.getState().programs).some((x) => x.is_active);
    if (fromTemplate) {
      // Same as "Use this program" on the template, after the changes.
      setActive(p.id);
      toast(`${p.name} is now your active program`);
      router.navigate('/workouts');
      return;
    }
    if (isNew && !hasActive && !single) setActive(p.id);
    close();
  };

  return (
    <Screen tabs={false} glow="left" glowTop={-100} gap={20}>
      <View style={styles.nav}>
        <FillButton label="Cancel" size="sm" onPress={cancel} labelStyle={{ fontWeight: '500' }} />
        <Text style={[type.bodyStrong, { fontSize: 17 }]}>
          {fromTemplate ? 'Customize program' : isNew ? `New ${what}` : `Edit ${what}`}
        </Text>
        <FillButton
          label={fromTemplate ? 'Use' : 'Save'}
          size="sm"
          onPress={save}
          labelStyle={{ color: colors.accent }}
        />
      </View>

      <FormGroup>
        <FormField
          label="Name"
          labelWidth={70}
          align="right"
          value={draft.name}
          onChangeText={(name) => setDraft((p) => ({ ...p, name }))}
          placeholder={single ? 'e.g. Arms pump, Hotel gym' : 'Program name'}
        />
        {single ? null : (
          <StepperRow
            label="Length"
            value={draft.weeks}
            min={1}
            max={52}
            onChange={(weeks) =>
              // Periodization follows the program length.
              setDraft((p) => ({
                ...p,
                weeks,
                phases: p.phases.length ? resizePhases(p.phases, weeks) : [],
              }))
            }
            format={(w) => `${w} week${w === 1 ? '' : 's'}`}
          />
        )}
      </FormGroup>

      {single ? (
        <Text style={[type.caption, { paddingHorizontal: 16, marginTop: -8 }]}>
          A one-off workout you can start any time, outside your program.
        </Text>
      ) : (
        <PhaseEditor
          phases={draft.phases}
          weeks={draft.weeks}
          onChange={(phases) => setDraft((p) => ({ ...p, phases }))}
        />
      )}

      {single ? null : (
        <View style={{ gap: 8 }}>
          <FieldLabel text="Training days" right={`${draft.training_days.length} per week`} />
          <View style={styles.days} accessibilityLabel="Training days">
            {LETTERS.map((l, i) => {
              const wd = i + 1;
              const on = draft.training_days.includes(wd);
              return (
                <Pressable
                  key={wd}
                  accessibilityRole="switch"
                  accessibilityLabel={weekdayName(wd)}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggleTrainingDay(wd)}
                  style={[styles.dayToggle, { backgroundColor: on ? colors.accent : colors.fill }]}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : colors.text }}
                  >
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <FieldLabel text={single ? 'Exercises' : 'Workouts'} />
        {draft.days.map((day) =>
          open === day.id ? (
            <DayCard
              key={day.id}
              day={day}
              trainingDays={draft.training_days}
              single={single}
              exercises={exercises}
              onChange={(fn) => patchDay(day.id, fn)}
              onAddExercise={() => setPickerFor(day.id)}
              onEditExercise={(ex) => setEditing({ dayId: day.id, ex })}
              onDelete={
                draft.days.length > 1
                  ? () => {
                      setDraft((p) => ({ ...p, days: p.days.filter((d) => d.id !== day.id) }));
                      setOpen(null);
                    }
                  : undefined
              }
            />
          ) : (
            <Glass key={day.id} radius={22} style={{ paddingHorizontal: 16 }}>
              <ListRow
                height={56}
                title={
                  <Text style={[type.bodyStrong, { fontSize: 17 }]}>
                    {day.name || 'Untitled day'}
                  </Text>
                }
                subtitle={[
                  weekdaysLabel(day.weekdays),
                  `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => setOpen(day.id)}
              />
            </Glass>
          ),
        )}
        {single ? null : (
          <FillButton
            label="Add workout day"
            icon={Plus}
            style={{ marginTop: 4 }}
            onPress={() => {
              const d = blankDay(draft.days.length);
              setDraft((p) => ({ ...p, days: [...p.days, d] }));
              setOpen(d.id);
            }}
          />
        )}
      </View>

      {single && !isNew ? (
        <TextButton
          label="Delete this workout"
          accent
          style={{ alignSelf: 'center', paddingVertical: 8 }}
          onPress={async () => {
            const ok = await confirm({
              title: `Delete ${initial.name}?`,
              message: 'Workouts you already did with it stay in your history.',
              confirmLabel: 'Delete',
              destructive: true,
            });
            if (!ok) return;
            useData.getState().deleteProgram(initial.id);
            close();
          }}
        />
      ) : null}

      <ExercisePicker
        visible={!!pickerFor}
        onClose={() => setPickerFor(null)}
        onPick={(exerciseId) => {
          const dayId = pickerFor;
          if (!dayId) return;
          const rec = recommend(primaryGoal(goals), exercises[exerciseId]?.name ?? '');
          patchDay(dayId, (d) => ({
            ...d,
            exercises: [
              ...d.exercises,
              {
                id: uuid(),
                exercise_id: exerciseId,
                position: d.exercises.length,
                ...rec,
              },
            ],
          }));
        }}
      />
      <ExercisePicker
        visible={!!swapping}
        onClose={() => {
          // Back to the exercise sheet. After a pick (onPick runs first) it is already set.
          setEditing((e) => e ?? swapping);
          setSwapping(null);
        }}
        onPick={(exerciseId) => {
          if (swapping)
            setEditing({ ...swapping, ex: { ...swapping.ex, exercise_id: exerciseId } });
          setSwapping(null);
        }}
      />
      <ExerciseSheet
        value={editing?.ex ?? null}
        originalId={editing ? (editing.origin ?? editing.ex.exercise_id) : null}
        exercises={exercises}
        goals={goals}
        onChooseOther={(ex) => {
          if (!editing) return;
          setSwapping({
            dayId: editing.dayId,
            ex,
            origin: editing.origin ?? editing.ex.exercise_id,
          });
          setEditing(null);
        }}
        aboveName={above ? (exercises[above.exercise_id]?.name ?? 'Exercise') : null}
        linkedAbove={!!above?.superset_id && above.superset_id === editing?.ex.superset_id}
        onClose={() => setEditing(null)}
        onSave={(ex, withAbove) => {
          if (!editing) return;
          patchDay(editing.dayId, (d) => {
            const list = d.exercises.map((e) => (e.id === ex.id ? ex : e));
            const i = list.findIndex((e) => e.id === ex.id);
            return { ...d, exercises: i > 0 ? linkWithAbove(list, i, withAbove, uuid) : list };
          });
          setEditing(null);
        }}
        onRemove={() => {
          if (!editing) return;
          patchDay(editing.dayId, (d) => ({
            ...d,
            exercises: cleanSupersets(d.exercises.filter((e) => e.id !== editing.ex.id)),
          }));
          setEditing(null);
        }}
      />
    </Screen>
  );
}

function DayCard({
  day,
  trainingDays,
  exercises,
  onChange,
  onAddExercise,
  onEditExercise,
  onDelete,
  single,
}: {
  day: ProgramDay;
  trainingDays: number[];
  /** Saved one-off workout: no day name or weekdays, just the exercise list. */
  single?: boolean;
  exercises: ReturnType<typeof useData.getState>['exercises'];
  onChange: (fn: (d: ProgramDay) => ProgramDay) => void;
  onAddExercise: () => void;
  onEditExercise: (ex: ProgramExercise) => void;
  onDelete?: () => void;
}) {
  const letters = supersetLetters(day.exercises.map((e) => ({ superset: e.superset_id })));
  return (
    <Glass radius={22} style={{ paddingTop: 4, paddingHorizontal: 16 }}>
      {single ? null : (
        <View style={styles.dayHead}>
          <TextInput
            value={day.name}
            onChangeText={(name) => onChange((d) => ({ ...d, name }))}
            placeholder="Day name"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Workout day name"
            style={styles.dayName}
          />
          <Text style={type.caption}>{weekdaysLabel(day.weekdays) || 'Any day'}</Text>
        </View>
      )}
      {!single && trainingDays.length > 0 ? (
        <View style={styles.assign}>
          <Text style={type.small}>On</Text>
          {[...trainingDays].sort().map((wd) => {
            const on = day.weekdays.includes(wd);
            return (
              <Pressable
                key={wd}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${day.name} on ${weekdayName(wd)}`}
                onPress={() =>
                  onChange((d) => ({
                    ...d,
                    weekdays: on ? d.weekdays.filter((x) => x !== wd) : [...d.weekdays, wd],
                  }))
                }
                style={[styles.assignChip, on && styles.assignOn]}
              >
                <Text style={{ fontSize: 13, fontWeight: on ? '600' : '500', color: colors.text }}>
                  {weekdayName(wd).slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {single ? null : <Separator />}
      <ReorderList
        items={day.exercises}
        rowHeight={ROW_H}
        onReorder={(from, to) =>
          onChange((d) => ({ ...d, exercises: cleanSupersets(move(d.exercises, from, to)) }))
        }
        renderRow={(e, i, handle) => {
          const ex = exercises[e.exercise_id];
          return (
            <View style={styles.exRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${ex?.name ?? 'exercise'}`}
                onPress={() => onEditExercise(e)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 16, color: colors.text }} numberOfLines={1}>
                    {ex?.name ?? 'Exercise'}
                  </Text>
                  <Text style={type.small} numberOfLines={1}>
                    {letters[i] ? (
                      <Text style={styles.ssMark}>Superset {letters[i]} · </Text>
                    ) : null}
                    {ex ? ex.muscles[0]?.replace(/^./, (c) => c.toUpperCase()) : ''}
                  </Text>
                </View>
                <Text style={{ fontSize: 15, color: colors.text2, fontVariant: ['tabular-nums'] }}>
                  {formatScheme(e.sets, e.reps_min, e.reps_max)}
                </Text>
              </Pressable>
              <View
                {...handle}
                accessibilityLabel={`Reorder ${ex?.name ?? 'exercise'}`}
                style={styles.handle}
              >
                <Equal size={16} color={colors.text3} strokeWidth={2} />
              </View>
            </View>
          );
        }}
      />
      <Pressable accessibilityRole="button" onPress={onAddExercise} style={styles.addEx}>
        <Plus size={16} color={colors.accent} strokeWidth={2.4} />
        <Text style={{ fontSize: 16, color: colors.accent }}>Add exercise</Text>
      </Pressable>
      {onDelete ? (
        <>
          <Separator />
          <TextButton label="Delete this day" onPress={onDelete} style={{ paddingVertical: 14 }} />
        </>
      ) : null}
    </Glass>
  );
}

function ExerciseSheet({
  value,
  originalId,
  exercises,
  goals,
  onClose,
  onChooseOther,
  aboveName,
  linkedAbove,
  onSave,
  onRemove,
}: {
  value: ProgramExercise | null;
  /** The exercise the program had before any swap. */
  originalId: string | null;
  exercises: Record<string, Exercise>;
  goals: Goal[];
  /** Opens the full exercise picker to swap this one; gets the edits made so far. */
  onChooseOther: (draft: ProgramExercise) => void;
  /** Name of the exercise above, when there is one to superset with. */
  aboveName: string | null;
  linkedAbove: boolean;
  onClose: () => void;
  onSave: (e: ProgramExercise, withAbove: boolean) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<ProgramExercise | null>(value);
  const [withAbove, setWithAbove] = useState(linkedAbove);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
    setWithAbove(linkedAbove);
  }
  const current = draft ? exercises[draft.exercise_id] : undefined;
  const name = current?.name ?? '';
  const original = originalId ? exercises[originalId] : undefined;
  // Suggestions stay those for the exercise the sheet opened with, so a swap can be undone.
  const similar = useMemo(
    () => (original ? similarExercises(original, Object.values(exercises)) : []),
    [original, exercises],
  );
  return (
    <Sheet
      visible={!!value}
      onClose={onClose}
      title={name}
      onDone={() => draft && onSave(draft, withAbove)}
    >
      {draft ? (
        <>
          <View style={{ gap: 6 }}>
            <Text style={[type.captionStrong, { paddingHorizontal: 4 }]}>Swap exercise</Text>
            <Glass radius={16} style={{ paddingHorizontal: 16 }}>
              {[...(original && original.id !== draft.exercise_id ? [original] : []), ...similar]
                .filter((e) => e.id !== draft.exercise_id)
                .map((e, i) => (
                  <View key={e.id}>
                    {i > 0 ? <Separator /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Swap to ${e.name}`}
                      onPress={() => setDraft({ ...draft, exercise_id: e.id })}
                      style={({ pressed }) => [styles.swapRow, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: 16, color: colors.text }} numberOfLines={1}>
                          {e.name}
                        </Text>
                        <Text style={type.small} numberOfLines={1}>
                          {e.id === original?.id ? 'Original · ' : ''}
                          {musclesLabel(e.muscles)}
                        </Text>
                      </View>
                      {e.tier ? <TierBadge tier={e.tier} /> : null}
                      <ArrowLeftRight size={16} color={colors.accent} strokeWidth={2.2} />
                    </Pressable>
                  </View>
                ))}
              {similar.length || (original && original.id !== draft.exercise_id) ? (
                <Separator />
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => onChooseOther(draft)}
                style={({ pressed }) => [styles.swapRow, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Search size={16} color={colors.accent} strokeWidth={2.4} />
                <Text style={{ fontSize: 16, color: colors.accent, flex: 1 }}>
                  Choose any exercise
                </Text>
              </Pressable>
            </Glass>
            {similar.length ? (
              <Text style={[type.small, { paddingHorizontal: 4 }]}>
                Top-rated picks for the same main muscle. S / A / B = Jeff Nippard&apos;s tier list.
              </Text>
            ) : null}
          </View>
          <FormGroup>
            <StepperRow
              label="Sets"
              value={draft.sets}
              min={1}
              max={20}
              onChange={(sets) => setDraft({ ...draft, sets })}
            />
            <StepperRow
              label="Reps min"
              value={draft.reps_min}
              min={1}
              max={50}
              onChange={(reps_min) =>
                setDraft({ ...draft, reps_min, reps_max: Math.max(reps_min, draft.reps_max) })
              }
            />
            <StepperRow
              label="Reps max"
              value={draft.reps_max}
              min={1}
              max={50}
              onChange={(reps_max) =>
                setDraft({ ...draft, reps_max, reps_min: Math.min(reps_max, draft.reps_min) })
              }
            />
            <StepperRow
              label="Rest"
              value={draft.rest_seconds}
              min={0}
              max={600}
              step={15}
              format={formatRest}
              onChange={(rest_seconds) => setDraft({ ...draft, rest_seconds })}
            />
          </FormGroup>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {formatScheme(draft.sets, draft.reps_min, draft.reps_max)} · rest{' '}
            {formatRest(draft.rest_seconds)}
          </Text>
          <Recommended
            name={name}
            goals={goals}
            current={draft}
            onApply={(rec) => setDraft({ ...draft, ...rec })}
          />
          {aboveName ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: withAbove }}
              onPress={() => setWithAbove(!withAbove)}
              style={styles.ssToggle}
            >
              <View style={[styles.ssBox, withAbove && styles.ssBoxOn]}>
                {withAbove ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 16, color: colors.text }}>
                  Superset with the one above
                </Text>
                <Text style={type.small} numberOfLines={1}>
                  Back to back with {aboveName}, rest after both
                </Text>
              </View>
              <Link size={16} color={withAbove ? colors.accent : colors.text3} strokeWidth={2.4} />
            </Pressable>
          ) : null}
          <FillButton label="Remove exercise" icon={Trash2} onPress={onRemove} />
        </>
      ) : null}
    </Sheet>
  );
}

/** "Recommended for your goals": one row per goal the user picked; tap to apply. */
function Recommended({
  name,
  goals,
  current,
  onApply,
}: {
  name: string;
  goals: Goal[];
  current: ProgramExercise;
  onApply: (r: Recommendation) => void;
}) {
  const list = orderedGoals(goals);
  const same = (r: Recommendation) =>
    r.sets === current.sets &&
    r.reps_min === current.reps_min &&
    r.reps_max === current.reps_max &&
    r.rest_seconds === current.rest_seconds;
  const active = list.find((g) => same(recommend(g, name)));
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel text={goals.length ? 'Recommended for your goals' : 'Recommended'} />
      <Glass radius={20} style={{ paddingHorizontal: 16 }}>
        {list.map((g, i) => {
          const r = recommend(g, name);
          const on = g === active;
          return (
            <View key={g}>
              {i > 0 ? <Separator /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Use ${GOAL_LABELS[g]}: ${formatScheme(r.sets, r.reps_min, r.reps_max)}, rest ${formatRest(r.rest_seconds)}`}
                onPress={() => onApply(r)}
                style={styles.recRow}
              >
                <Text style={[type.body, { flex: 1, fontSize: 16 }]}>{GOAL_LABELS[g]}</Text>
                <Text style={[type.body, { color: colors.text2, fontVariant: ['tabular-nums'] }]}>
                  {formatScheme(r.sets, r.reps_min, r.reps_max)} · {formatRest(r.rest_seconds)}
                </Text>
                {on ? (
                  <Check size={16} color={colors.accent} strokeWidth={3} />
                ) : (
                  <View style={{ width: 16 }} />
                )}
              </Pressable>
            </View>
          );
        })}
      </Glass>
      <Text style={[type.small, { paddingHorizontal: 16 }]}>{GOAL_NOTES[active ?? list[0]]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 6,
  },
  ssToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  ssBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.text3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ssBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  ssMark: { fontSize: 11, fontWeight: '700', color: colors.accent },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  days: { flexDirection: 'row', gap: 6 },
  dayToggle: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  dayName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 10,
    outlineStyle: 'none',
  } as object,
  assign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },
  assignChip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: colors.fill,
    justifyContent: 'center',
  },
  assignOn: { backgroundColor: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
  exRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  handle: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
  } as object,
  addEx: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
