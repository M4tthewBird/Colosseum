import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { Check, Settings2 } from '@/components/icons';
import { ListGroup, ListRow, SectionHeader, Separator } from '@/components/List';
import { Sheet } from '@/components/Sheet';
import { formatScheme } from '@/lib/formulas';
import { defaultPhases, PHASE_NOTES, phaseWeeks } from '@/lib/periodization';
import { weekdaysLabel } from '@/lib/programs';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';
import { PhaseStrip } from './PhaseStrip';
import { instantiateTemplate, setsPerWeek, TEMPLATES, type ProgramTemplate } from './templates';

/** "Start from a template": built-in programs; using one makes the user's own editable copy. */
export function TemplateList() {
  const [open, setOpen] = useState<ProgramTemplate | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <SectionHeader title="Start from a template" />
      <ListGroup>
        {TEMPLATES.map((t) => (
          <ListRow
            key={t.key}
            height={64}
            title={<Text style={[type.bodyStrong, { fontSize: 16 }]}>{t.name}</Text>}
            subtitle={`${t.trainingDays.length} days · ${t.weeks} weeks · ${t.level} · ${t.goal}`}
            onPress={() => setOpen(t)}
          />
        ))}
      </ListGroup>
      <TemplateSheet template={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function TemplateSheet({
  template: t,
  onClose,
}: {
  template: ProgramTemplate | null;
  onClose: () => void;
}) {
  const userId = useData((s) => s.userId);
  const exercises = useData((s) => s.exercises);
  const hasActive = useData((s) => Object.values(s.programs).some((p) => p.is_active));
  const save = useData((s) => s.saveProgram);
  const setActive = useData((s) => s.setActiveProgram);

  const use = (activate: boolean) => {
    if (!t) return;
    const p = instantiateTemplate(t, userId, exercises);
    save(p);
    if (activate) setActive(p.id);
    toast(activate ? `${t.name} is now your active program` : `${t.name} added to your programs`);
    onClose();
    if (activate) router.navigate('/workouts');
  };

  return (
    <Sheet visible={!!t} onClose={onClose} title={t?.name}>
      {t ? (
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Text style={[type.body, { color: colors.text2 }]}>{t.summary}</Text>
          <View style={styles.facts}>
            <Fact value={`${t.trainingDays.length}×`} label="per week" />
            <Fact value={`${t.weeks}`} label="weeks" />
            <Fact value={`${setsPerWeek(t)}`} label="sets / week" />
            <Fact value={t.level} label="level" />
          </View>

          {t.days.map((d) => (
            <Glass key={d.name} radius={20} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <View style={styles.dayHead}>
                <Text style={[type.bodyStrong, { fontSize: 16 }]}>{d.name}</Text>
                <Text style={type.caption}>{weekdaysLabel(d.weekdays)}</Text>
              </View>
              {d.exercises.map(([name, sets, min, max]) => (
                <View key={name} style={styles.exRow}>
                  <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={[type.caption, tabular]}>{formatScheme(sets, min, max)}</Text>
                </View>
              ))}
            </Glass>
          ))}

          <View style={{ gap: 8 }}>
            <Text style={[type.captionStrong, { paddingHorizontal: 4 }]}>8-week periodization</Text>
            <PhaseStrip phases={defaultPhases(t.weeks)} />
            <Glass radius={20} style={{ paddingHorizontal: 16 }}>
              {defaultPhases(t.weeks).map((p, i) => (
                <View key={p.name}>
                  {i > 0 ? <Separator /> : null}
                  <View style={styles.phaseRow}>
                    <Text style={[type.bodyStrong, { width: 64 }]}>{p.name}</Text>
                    <Text style={[type.caption, { flex: 1 }]}>{PHASE_NOTES[p.name]}</Text>
                    <Text style={[type.small, tabular]}>{phaseWeeks(p)}</Text>
                  </View>
                </View>
              ))}
            </Glass>
            <Text style={[type.small, { paddingHorizontal: 4 }]}>
              Progression: when you hit the top of the rep range in every set, add weight next time.
            </Text>
          </View>

          <FillButton
            label="Customize first"
            icon={Settings2}
            accessibilityHint="Swap exercises or change sets before you start"
            onPress={() => {
              onClose();
              router.push({ pathname: '/program/[id]', params: { id: 'new', template: t.key } });
            }}
          />
          <FillButton label="Use this program" icon={Check} ready onPress={() => use(true)} />
          {hasActive ? (
            <FillButton label="Add without making it active" onPress={() => use(false)} />
          ) : null}
          <Text style={[type.small, { textAlign: 'center' }]}>
            You get your own copy: change any day, exercise or number now or later.
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type.bodyStrong, { fontSize: 17, fontWeight: '700' }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row' },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 6,
  },
});
