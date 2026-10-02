import { router, useLocalSearchParams } from 'expo-router';
import { Check, Equal, Plus, Trash2 } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { FieldLabel, FormField, FormGroup, StepperRow } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { ListRow, Separator } from '@/components/List';
import { move, ReorderList } from '@/components/ReorderList';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { blankDay, blankProgram, normalizeProgram } from '@/features/programs/ops';
import { weekdayName } from '@/lib/dates';
import { formatRest, formatScheme } from '@/lib/formulas';
import { defaultPhases, PHASE_NOTES, phaseWeeks } from '@/lib/periodization';
import { weekdaysLabel } from '@/lib/programs';
import { PhaseStrip } from '@/features/programs/PhaseStrip';
import { Segmented } from '@/components/Segmented';
import {
  GOAL_LABELS,
  GOAL_NOTES,
  orderedGoals,
  primaryGoal,
  recommend,
  type Recommendation,
} from '@/lib/repRanges';
import type { Goal, Program, ProgramDay, ProgramExercise } from '@/lib/types';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useData((s) => (id && id !== 'new' ? s.programs[id] : undefined));
  const userId = useData((s) => s.userId);
  const exercises = useData((s) => s.exercises);
  const saveProgram = useData((s) => s.saveProgram);
  const setActive = useData((s) => s.setActiveProgram);
  const goals = useData((s) => s.profile?.goals ?? []);

  const initial = useMemo(() => existing ?? blankProgram(userId), [existing, userId]);
  const [draft, setDraft] = useState<Program>(initial);
  const [open, setOpen] = useState<string | null>(initial.days[0]?.id ?? null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ dayId: string; ex: ProgramExercise } | null>(null);

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
        message: 'Your changes to this program are not saved.',
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
      toast('Give the program a name');
      return;
    }
    const p = normalizeProgram(draft);
    saveProgram(p);
    const hasActive = Object.values(useData.getState().programs).some((x) => x.is_active);
    if (isNew && !hasActive) setActive(p.id);
    close();
  };

  return (
    <Screen tabs={false} glow="left" glowTop={-100} gap={20}>
      <View style={styles.nav}>
        <FillButton label="Cancel" size="sm" onPress={cancel} labelStyle={{ fontWeight: '500' }} />
        <Text style={[type.bodyStrong, { fontSize: 17 }]}>
          {isNew ? 'New program' : 'Edit program'}
        </Text>
        <FillButton label="Save" size="sm" onPress={save} labelStyle={{ color: colors.accent }} />
      </View>

      <FormGroup>
        <FormField
          label="Name"
          labelWidth={70}
          align="right"
          value={draft.name}
          onChangeText={(name) => setDraft((p) => ({ ...p, name }))}
          placeholder="Program name"
        />
        <StepperRow
          label="Length"
          value={draft.weeks}
          min={1}
          max={52}
          onChange={(weeks) =>
            // Periodization follows the program length.
            setDraft((p) => ({ ...p, weeks, phases: p.phases.length ? defaultPhases(weeks) : [] }))
          }
          format={(w) => `${w} week${w === 1 ? '' : 's'}`}
        />
      </FormGroup>

      <View style={{ gap: 8 }}>
        <FieldLabel text="Periodization" />
        <Segmented
          options={[
            { value: 'on', label: 'Phases' },
            { value: 'off', label: 'Same every week' },
          ]}
          value={draft.phases.length ? 'on' : 'off'}
          onChange={(v) =>
            setDraft((p) => ({ ...p, phases: v === 'on' ? defaultPhases(p.weeks) : [] }))
          }
          accessibilityLabel="Periodization"
        />
        {draft.phases.length ? (
          <Glass radius={20} style={{ padding: 16, gap: 10 }}>
            <PhaseStrip phases={draft.phases} />
            {draft.phases.map((ph) => (
              <View key={ph.name} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={[type.bodyStrong, { width: 64 }]}>{ph.name}</Text>
                <Text style={[type.caption, { flex: 1 }]}>{PHASE_NOTES[ph.name]}</Text>
                <Text style={type.small}>{phaseWeeks(ph)}</Text>
              </View>
            ))}
            <Text style={type.small}>
              Sets below are the Build-week sets; each phase scales them when you start a workout.
            </Text>
          </Glass>
        ) : null}
      </View>

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
                <Text style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : colors.text }}>
                  {l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <FieldLabel text="Workouts" />
        {draft.days.map((day) =>
          open === day.id ? (
            <DayCard
              key={day.id}
              day={day}
              trainingDays={draft.training_days}
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
      </View>

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
      <ExerciseSheet
        value={editing?.ex ?? null}
        name={editing ? (exercises[editing.ex.exercise_id]?.name ?? '') : ''}
        goals={goals}
        onClose={() => setEditing(null)}
        onSave={(ex) => {
          if (!editing) return;
          patchDay(editing.dayId, (d) => ({
            ...d,
            exercises: d.exercises.map((e) => (e.id === ex.id ? ex : e)),
          }));
          setEditing(null);
        }}
        onRemove={() => {
          if (!editing) return;
          patchDay(editing.dayId, (d) => ({
            ...d,
            exercises: d.exercises.filter((e) => e.id !== editing.ex.id),
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
}: {
  day: ProgramDay;
  trainingDays: number[];
  exercises: ReturnType<typeof useData.getState>['exercises'];
  onChange: (fn: (d: ProgramDay) => ProgramDay) => void;
  onAddExercise: () => void;
  onEditExercise: (ex: ProgramExercise) => void;
  onDelete?: () => void;
}) {
  return (
    <Glass radius={22} style={{ paddingTop: 4, paddingHorizontal: 16 }}>
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
      {trainingDays.length > 0 ? (
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
      <Separator />
      <ReorderList
        items={day.exercises}
        rowHeight={ROW_H}
        onReorder={(from, to) =>
          onChange((d) => ({ ...d, exercises: move(d.exercises, from, to) }))
        }
        renderRow={(e, _i, handle) => {
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
  name,
  goals,
  onClose,
  onSave,
  onRemove,
}: {
  value: ProgramExercise | null;
  name: string;
  goals: Goal[];
  onClose: () => void;
  onSave: (e: ProgramExercise) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<ProgramExercise | null>(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <Sheet visible={!!value} onClose={onClose} title={name} onDone={() => draft && onSave(draft)}>
      {draft ? (
        <>
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
