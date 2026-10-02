/**
 * Periodization settings in the program editor. The recommended phases are the default; every
 * phase can be changed, but leaving the recommendation (or switching phases off) asks first.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { FieldHint, FieldLabel, FormGroup, StepperRow } from '@/components/Form';
import { Glass } from '@/components/Glass';
import { ChevronRight } from '@/components/icons';
import { Separator } from '@/components/List';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import {
  defaultPhases,
  PHASE_NOTES,
  phaseWeeks,
  phasedSets,
  rpeHint,
  type Phase,
} from '@/lib/periodization';
import { confirm } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';
import { PhaseStrip } from './PhaseStrip';

const pct = (m: number) => `${Math.round(m * 100)} %`;

function recommendedFor(weeks: number, name: string): Phase | undefined {
  return defaultPhases(weeks).find((p) => p.name === name);
}

function isRecommended(weeks: number, p: Phase): boolean {
  const r = recommendedFor(weeks, p.name);
  return !!r && r.sets === p.sets && r.rpe === p.rpe;
}

export function PhaseEditor({
  phases,
  weeks,
  onChange,
}: {
  phases: Phase[];
  weeks: number;
  onChange: (phases: Phase[]) => void;
}) {
  const [editing, setEditing] = useState<Phase | null>(null);
  const custom = phases.some((p) => !isRecommended(weeks, p));

  const toggle = async (v: 'on' | 'off') => {
    if (v === 'on') return onChange(defaultPhases(weeks));
    const ok = await confirm({
      title: 'Turn off periodization?',
      message:
        'Recommended: keep the phases. They ease you in, build up, and end with a deload week so you recover and keep progressing. Without them every week is the same.',
      confirmLabel: 'Turn off anyway',
      cancelLabel: 'Keep phases',
      destructive: true,
    });
    if (ok) onChange([]);
  };

  return (
    <View style={{ gap: 8 }}>
      <FieldLabel
        text="Periodization"
        right={phases.length ? (custom ? 'Custom' : 'Recommended') : undefined}
      />
      <Segmented
        options={[
          { value: 'on', label: 'Phases' },
          { value: 'off', label: 'Same every week' },
        ]}
        value={phases.length ? 'on' : 'off'}
        onChange={toggle}
        accessibilityLabel="Periodization"
      />
      {phases.length ? (
        <>
          <Glass radius={20} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
            <PhaseStrip phases={phases} />
            <View style={{ height: 6 }} />
            {phases.map((ph, i) => {
              const rec = isRecommended(weeks, ph);
              return (
                <View key={ph.name}>
                  {i > 0 ? <Separator /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${ph.name}`}
                    onPress={() => setEditing(ph)}
                    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={type.bodyStrong}>
                        {ph.name} <Text style={[type.small, tabular]}>{phaseWeeks(ph)}</Text>
                      </Text>
                      <Text style={[type.small, tabular]}>
                        Sets {pct(ph.sets)} · RPE {ph.rpe}
                        {rec ? '' : ' · changed'}
                      </Text>
                    </View>
                    {!rec ? <View style={styles.dot} /> : null}
                    <ChevronRight size={14} color={colors.text3} strokeWidth={2.8} />
                  </Pressable>
                </View>
              );
            })}
          </Glass>
          <Text style={[type.small, { paddingHorizontal: 16 }]}>
            Exercise sets below are the Build-week sets; each phase scales them when you start a
            workout.
          </Text>
          {custom ? (
            <TextButton
              label="Reset to recommended"
              accent
              style={{ paddingHorizontal: 16, paddingVertical: 4 }}
              onPress={() => onChange(defaultPhases(weeks))}
            />
          ) : null}
        </>
      ) : null}
      <PhaseSheet
        phase={editing}
        recommended={editing ? recommendedFor(weeks, editing.name) : undefined}
        onClose={() => setEditing(null)}
        onSave={async (next) => {
          const before = editing;
          // Close the sheet first: the confirm dialog must not open underneath it.
          setEditing(null);
          const rec = recommendedFor(weeks, next.name);
          const changed = before && (next.sets !== before.sets || next.rpe !== before.rpe);
          let chosen = next;
          if (changed && rec && !isRecommended(weeks, next)) {
            const ok = await confirm({
              title: `Change ${next.name} from the recommendation?`,
              message: `Recommended: sets ${pct(rec.sets)}, RPE ${rec.rpe}. Yours: sets ${pct(next.sets)}, RPE ${next.rpe}. You can reset it any time.`,
              confirmLabel: 'Use my changes',
              cancelLabel: 'Keep recommended',
            });
            if (!ok) chosen = { ...next, sets: rec.sets, rpe: rec.rpe };
          }
          onChange(phases.map((p) => (p.name === chosen.name ? chosen : p)));
        }}
      />
    </View>
  );
}

function PhaseSheet({
  phase,
  recommended,
  onClose,
  onSave,
}: {
  phase: Phase | null;
  recommended?: Phase;
  onClose: () => void;
  onSave: (p: Phase) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Phase | null>(phase);
  const [seen, setSeen] = useState(phase);
  if (phase !== seen) {
    setSeen(phase);
    setDraft(phase);
  }

  const done = () => {
    if (draft) void onSave(draft);
  };

  return (
    <Sheet visible={!!phase} onClose={onClose} title={phase?.name} onDone={done}>
      {draft ? (
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Text style={[type.caption, { paddingHorizontal: 4 }]}>
            {phaseWeeks(draft)} · {PHASE_NOTES[draft.name]}
          </Text>
          <FormGroup>
            <StepperRow
              label="Sets"
              value={Math.round(draft.sets * 100)}
              min={25}
              max={200}
              step={25}
              format={(v) => `${v} %`}
              onChange={(v) => setDraft({ ...draft, sets: v / 100 })}
            />
            <StepperRow
              label="Effort (RPE)"
              value={draft.rpe}
              min={5}
              max={10}
              onChange={(rpe) => setDraft({ ...draft, rpe })}
            />
          </FormGroup>
          <FieldHint
            text={`A 4-set exercise becomes ${phasedSets(4, draft)} sets, 3 sets become ${phasedSets(3, draft)}. RPE ${draft.rpe}: ${rpeHint(draft.rpe)}.`}
          />
          {recommended ? (
            <FieldHint
              text={`Recommended: sets ${pct(recommended.sets)}, RPE ${recommended.rpe}.`}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
