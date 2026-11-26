/**
 * Log a run by hand (id "new") or edit one: distance, time, outdoor or treadmill, when, and
 * optionally heart rate, elevation and a note. The pace follows from distance and time.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { FieldHint, FieldLabel, FormField, FormGroup } from '@/components/Form';
import { GlassCard } from '@/components/Glass';
import { Footprints } from '@/components/icons';
import { Header, Screen } from '@/components/Screen';
import { Chip, Segmented } from '@/components/Segmented';
import { saveRun } from '@/features/running/actions';
import { addDays, sameDay, shortDate, startOfDay, weekdayShort, isoWeekday } from '@/lib/dates';
import { RUN } from '@/lib/game/config';
import {
  formatPace,
  formatRunTime,
  paceOf,
  parseKm,
  parseRunTime,
  runProblem,
  runQualifies,
} from '@/lib/running';
import type { RunPlace } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';

/** Runs can be logged for today and the 6 days before. */
const DAYS_BACK = 6;

function parseClockTime(text: string): { h: number; m: number } | null {
  const m = text.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? { h, m: min } : null;
}

const two = (n: number) => String(n).padStart(2, '0');

function dayLabel(d: Date, today: Date): string {
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, addDays(today, -1))) return 'Yesterday';
  return `${weekdayShort(isoWeekday(d))} ${d.getDate()}`;
}

export default function LogRun() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useData((s) => (id && id !== 'new' ? s.sessions[id] : undefined));
  const editing = !!existing && existing.kind === 'run';
  // Ticks so "just finished" and the future check follow the clock.
  const now = useNow(true, 15000);
  const today = startOfDay(new Date(now));
  const startedBefore = editing ? new Date(existing.started_at) : null;

  const [place, setPlace] = useState<RunPlace>(existing?.run_place ?? 'outdoor');
  const [km, setKm] = useState(
    existing?.distance_m ? String(Math.round(existing.distance_m / 10) / 100) : '',
  );
  const [time, setTime] = useState(existing?.duration_s ? formatRunTime(existing.duration_s) : '');
  const [day, setDay] = useState<Date>(startedBefore ? startOfDay(startedBefore) : today);
  const [start, setStart] = useState(
    startedBefore ? `${two(startedBefore.getHours())}:${two(startedBefore.getMinutes())}` : '',
  );
  const [hr, setHr] = useState(existing?.avg_hr ? String(existing.avg_hr) : '');
  const [elevation, setElevation] = useState(
    existing?.elevation_m != null ? String(existing.elevation_m) : '',
  );
  const [note, setNote] = useState(existing?.notes?.run ?? '');

  const distanceM = parseKm(km);
  const durationS = parseRunTime(time);
  const problem = distanceM && durationS ? runProblem(distanceM, durationS) : null;
  const clock = start.trim() ? parseClockTime(start) : null;
  const hrValue = hr.trim() ? Number(hr) : null;
  const elevationValue = elevation.trim() ? Number(elevation) : null;
  const hrOk = hrValue == null || (Number.isInteger(hrValue) && hrValue >= 60 && hrValue <= 220);
  const elevationOk =
    elevationValue == null ||
    (Number.isInteger(elevationValue) && elevationValue >= 0 && elevationValue <= 10000);

  // Start: the typed time on the chosen day, or (today) now minus the duration.
  let startedAt: Date | null = null;
  if (clock) {
    startedAt = new Date(day);
    startedAt.setHours(clock.h, clock.m, 0, 0);
  } else if (!start.trim() && durationS) {
    startedAt = sameDay(day, today)
      ? new Date(now - durationS * 1000)
      : new Date(new Date(day).setHours(12, 0, 0, 0));
  }
  const inFuture =
    !!startedAt && !!durationS && startedAt.getTime() + durationS * 1000 > now + 60000;

  const ready =
    !!distanceM &&
    !!durationS &&
    !!startedAt &&
    problem !== 'too-fast' &&
    problem !== 'too-long' &&
    !inFuture &&
    hrOk &&
    elevationOk &&
    (!start.trim() || !!clock);

  const hint = (): { text: string; error?: boolean } | null => {
    if (km.trim() && !distanceM) return { text: 'Type the distance in km, like 5.2.', error: true };
    if (time.trim() && !durationS)
      return { text: 'Type the time as 24:05 or 1:02:05.', error: true };
    if (problem === 'too-fast')
      return {
        text: 'That is faster than the world record. Check the distance and time.',
        error: true,
      };
    if (problem === 'too-long')
      return { text: 'A run can be at most 100 km and 12 hours.', error: true };
    if (problem === 'too-slow')
      return {
        text: `Slower than ${formatPace(RUN.maxPace)} counts as a walk: it is saved, but earns nothing.`,
      };
    if (distanceM && durationS && !runQualifies({ distance_m: distanceM, duration_s: durationS }))
      return { text: 'Runs from 3 km or 20 minutes earn XP and laurels.' };
    return null;
  };
  const h = hint();

  const save = () => {
    if (!ready) return;
    const runId = saveRun({
      id: editing ? existing.id : undefined,
      startedAt: startedAt!,
      distanceM: distanceM!,
      durationS: durationS!,
      place,
      elevationM: elevationValue,
      avgHr: hrValue,
      note,
    });
    if (editing) {
      toast('Run updated');
      router.back();
    } else router.replace({ pathname: '/session/[id]', params: { id: runId, fresh: '1' } });
  };

  const days = Array.from({ length: DAYS_BACK + 1 }, (_, i) => addDays(today, -i));

  return (
    <Screen tabs={false} gap={16}>
      <BackLink label="Workouts" fallback="/workouts" />
      <Header above="Running" title={editing ? 'Edit run' : 'Log a run'} />

      <Segmented
        options={[
          { value: 'outdoor', label: 'Outdoor' },
          { value: 'treadmill', label: 'Treadmill' },
        ]}
        value={place}
        onChange={setPlace}
        accessibilityLabel="Where you ran"
      />

      <FormGroup>
        <FormField
          label="Distance"
          value={km}
          onChangeText={setKm}
          placeholder="5.0"
          keyboardType="decimal-pad"
          suffix="km"
          autoFocus={!editing}
        />
        <FormField
          label="Time"
          value={time}
          onChangeText={setTime}
          placeholder="24:05"
          keyboardType="numbers-and-punctuation"
        />
      </FormGroup>

      <GlassCard radius={22} style={styles.pace}>
        <Text style={[styles.paceValue, tabular]} accessibilityLabel="Average pace">
          {distanceM && durationS ? formatPace(paceOf(distanceM, durationS)) : '–:–– /km'}
        </Text>
        <Text style={type.small}>Average pace</Text>
      </GlassCard>
      {h ? <FieldHint text={h.text} error={h.error} /> : null}

      <View style={{ gap: 8 }}>
        <FieldLabel text="When" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.days}
        >
          {days.map((d) => (
            <Chip
              key={d.toISOString()}
              label={dayLabel(d, today)}
              selected={sameDay(d, day)}
              onPress={() => setDay(d)}
            />
          ))}
        </ScrollView>
        <FormGroup>
          <FormField
            label="Start time"
            value={start}
            onChangeText={setStart}
            placeholder={sameDay(day, today) ? 'Just finished' : '12:00'}
            keyboardType="numbers-and-punctuation"
          />
        </FormGroup>
        {start.trim() && !clock ? (
          <FieldHint text="Type the start time as 07:30." error />
        ) : inFuture ? (
          <FieldHint text="That run would end in the future." error />
        ) : (
          <FieldHint
            text={
              sameDay(day, today)
                ? 'Leave it empty if you just finished.'
                : `On ${shortDate(day)}. Leave it empty if you do not remember.`
            }
          />
        )}
      </View>

      <View style={{ gap: 8 }}>
        <FieldLabel text="Optional" />
        <FormGroup>
          <FormField
            label="Avg heart rate"
            labelWidth={124}
            value={hr}
            onChangeText={setHr}
            placeholder="—"
            keyboardType="number-pad"
            suffix="bpm"
          />
          <FormField
            label="Elevation gain"
            labelWidth={124}
            value={elevation}
            onChangeText={setElevation}
            placeholder="—"
            keyboardType="number-pad"
            suffix="m"
          />
          <FormField
            label="Note"
            labelWidth={124}
            value={note}
            onChangeText={setNote}
            placeholder="Easy run, intervals…"
            maxLength={200}
          />
        </FormGroup>
        <FieldHint
          text={
            !hrOk
              ? 'Heart rate is between 60 and 220 bpm.'
              : !elevationOk
                ? 'Elevation gain is a whole number of metres.'
                : 'Only you see your heart rate.'
          }
          error={!hrOk || !elevationOk}
        />
      </View>

      <FillButton
        label={editing ? 'Save changes' : 'Save run'}
        icon={Footprints}
        ready={ready}
        disabled={!ready}
        onPress={save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pace: { alignItems: 'center', paddingVertical: 14, gap: 2 },
  paceValue: { fontSize: 30, fontWeight: '700', letterSpacing: -0.8, color: colors.text },
  days: { gap: 8, paddingHorizontal: 2 },
});
