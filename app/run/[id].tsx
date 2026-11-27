/**
 * Log a run, ride or swim by hand (id "new", ?sport=ride|swim; a run without it) or edit one:
 * distance, time, where, when, and optionally heart rate, elevation and a note. The pace (or a
 * ride's speed) follows from distance and time.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { FieldHint, FieldLabel, FormField, FormGroup } from '@/components/Form';
import { GlassCard } from '@/components/Glass';
import { Header, Screen } from '@/components/Screen';
import { Chip, Segmented } from '@/components/Segmented';
import { saveCardio } from '@/features/running/actions';
import { SPORT_ICONS } from '@/features/running/sportIcons';
import {
  cardioProblem,
  cardioQualifies,
  paceLabel,
  paceText,
  parseDistance,
  slowestText,
  SPORT,
  sportOf,
  type Sport,
} from '@/lib/cardio';
import { addDays, sameDay, shortDate, startOfDay, weekdayShort, isoWeekday } from '@/lib/dates';
import { formatRunTime, parseRunTime } from '@/lib/running';
import type { RunPlace } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, tabular, type } from '@/theme/tokens';

/** Sessions can be logged for today and the 6 days before. */
const DAYS_BACK = 6;

const TOO_LONG: Record<Sport, string> = {
  run: 'A run can be at most 100 km and 12 hours.',
  ride: 'A ride can be at most 400 km and 16 hours.',
  swim: 'A swim can be at most 30 km and 12 hours.',
};

const PLACEHOLDER: Record<Sport, { distance: string; time: string; note: string }> = {
  run: { distance: '5.0', time: '24:05', note: 'Easy run, intervals…' },
  ride: { distance: '40', time: '1:20:00', note: 'Hills, group ride…' },
  swim: { distance: '1500', time: '32:00', note: 'Crawl, intervals…' },
};

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

export default function LogCardio() {
  const { id, sport: asked } = useLocalSearchParams<{ id: string; sport?: string }>();
  const existing = useData((s) => (id && id !== 'new' ? s.sessions[id] : undefined));
  const existingSport = existing ? sportOf(existing) : null;
  const editing = !!existing && existingSport != null;
  const sport: Sport = existingSport ?? (asked === 'ride' || asked === 'swim' ? asked : 'run');
  const info = SPORT[sport];
  // Ticks so "just finished" and the future check follow the clock.
  const now = useNow(true, 15000);
  const today = startOfDay(new Date(now));
  const startedBefore = editing ? new Date(existing.started_at) : null;

  const [place, setPlace] = useState<RunPlace>(existing?.run_place ?? info.places[0].id);
  const [distance, setDistance] = useState(
    existing?.distance_m
      ? info.unit === 'm'
        ? String(existing.distance_m)
        : String(Math.round(existing.distance_m / 10) / 100)
      : '',
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

  const distanceM = parseDistance(sport, distance);
  const durationS = parseRunTime(time);
  const problem = distanceM && durationS ? cardioProblem(sport, distanceM, durationS) : null;
  const clock = start.trim() ? parseClockTime(start) : null;
  const hrValue = hr.trim() ? Number(hr) : null;
  const elevationValue = sport !== 'swim' && elevation.trim() ? Number(elevation) : null;
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
    if (distance.trim() && !distanceM)
      return {
        text:
          info.unit === 'm'
            ? 'Type the distance in metres, like 1500.'
            : 'Type the distance in km, like 5.2.',
        error: true,
      };
    if (time.trim() && !durationS)
      return { text: 'Type the time as 24:05 or 1:02:05.', error: true };
    if (problem === 'too-fast')
      return {
        text:
          sport === 'ride'
            ? 'That is faster than 60 km/h on average. Check the distance and time.'
            : 'That is faster than the world record. Check the distance and time.',
        error: true,
      };
    if (problem === 'too-long') return { text: TOO_LONG[sport], error: true };
    if (problem === 'too-slow')
      return {
        text: `Slower than ${slowestText(sport)} is saved, but earns nothing.`,
      };
    if (
      distanceM &&
      durationS &&
      !cardioQualifies(sport, { distance_m: distanceM, duration_s: durationS })
    )
      return { text: info.minText };
    return null;
  };
  const h = hint();

  const save = () => {
    if (!ready) return;
    const sessionId = saveCardio({
      sport,
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
      toast(`${info.name} updated`);
      router.back();
    } else router.replace({ pathname: '/session/[id]', params: { id: sessionId, fresh: '1' } });
  };

  const days = Array.from({ length: DAYS_BACK + 1 }, (_, i) => addDays(today, -i));
  const noun = info.name.toLowerCase();

  return (
    <Screen tabs={false} gap={16}>
      <BackLink label="Workouts" fallback="/workouts" />
      <Header above={info.title} title={editing ? `Edit ${noun}` : `Log ${info.noun}`} />

      <Segmented
        options={info.places.map((p) => ({ value: p.id, label: p.label }))}
        value={place}
        onChange={setPlace}
        accessibilityLabel={`Where you ${sport === 'run' ? 'ran' : sport === 'ride' ? 'rode' : 'swam'}`}
      />

      <FormGroup>
        <FormField
          label="Distance"
          value={distance}
          onChangeText={setDistance}
          placeholder={PLACEHOLDER[sport].distance}
          keyboardType={info.unit === 'm' ? 'number-pad' : 'decimal-pad'}
          suffix={info.unit}
          autoFocus={!editing}
        />
        <FormField
          label="Time"
          value={time}
          onChangeText={setTime}
          placeholder={PLACEHOLDER[sport].time}
          keyboardType="numbers-and-punctuation"
        />
      </FormGroup>

      <GlassCard radius={22} style={styles.pace}>
        <Text style={[styles.paceValue, tabular]} accessibilityLabel={paceLabel(sport)}>
          {distanceM && durationS
            ? paceText(sport, distanceM, durationS)
            : sport === 'ride'
              ? '–– km/h'
              : sport === 'swim'
                ? '–:–– /100 m'
                : '–:–– /km'}
        </Text>
        <Text style={type.small}>{paceLabel(sport)}</Text>
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
          <FieldHint text={`That ${noun} would end in the future.`} error />
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
          {sport !== 'swim' ? (
            <FormField
              label="Elevation gain"
              labelWidth={124}
              value={elevation}
              onChangeText={setElevation}
              placeholder="—"
              keyboardType="number-pad"
              suffix="m"
            />
          ) : null}
          <FormField
            label="Note"
            labelWidth={124}
            value={note}
            onChangeText={setNote}
            placeholder={PLACEHOLDER[sport].note}
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
        label={editing ? 'Save changes' : `Save ${noun}`}
        icon={SPORT_ICONS[sport]}
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
