import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { daysInMonth, isoWeekday, monthName, sameDay, startOfDay } from '@/lib/dates';
import type { Session } from '@/lib/types';
import { colors, type } from '@/theme/tokens';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month grid, Monday first. Trained = grey, PR = accent, today = accent ring, future dimmed. */
export function MonthCalendar({ sessions }: { sessions: Session[] }) {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const byDay = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const s of sessions) {
      const d = new Date(s.started_at);
      if (d.getFullYear() !== month.y || d.getMonth() !== month.m) continue;
      const list = map.get(d.getDate()) ?? [];
      list.push(s);
      map.set(d.getDate(), list);
    }
    return map;
  }, [sessions, month]);

  const count = [...byDay.values()].reduce((n, l) => n + l.length, 0);
  const lead = isoWeekday(new Date(month.y, month.m, 1)) - 1;
  const days = daysInMonth(month.y, month.m);
  const shift = (delta: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const title =
    month.y === today.getFullYear() ? monthName(month.m) : `${monthName(month.m)} ${month.y}`;

  return (
    <GlassCard style={{ padding: 16, gap: 10 }}>
      <View style={styles.head}>
        <Text style={[type.bodyStrong, { fontSize: 17, fontWeight: '700' }]}>{title}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconButton
            icon={ChevronLeft}
            size={30}
            iconSize={13}
            accessibilityLabel="Previous month"
            onPress={() => shift(-1)}
          />
          <IconButton
            icon={ChevronRight}
            size={30}
            iconSize={13}
            accessibilityLabel="Next month"
            onPress={() => shift(1)}
          />
        </View>
      </View>
      <View style={styles.grid}>
        {LETTERS.map((l, i) => (
          <View key={`h${i}`} style={styles.cell}>
            <Text style={styles.weekday}>{l}</Text>
          </View>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <View key={`e${i}`} style={styles.cell} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const date = new Date(month.y, month.m, d);
          const list = byDay.get(d);
          const trained = !!list;
          const pr = !!list?.some((s) => s.pr_count > 0);
          const isToday = sameDay(date, today);
          const future = date > today;
          const fg = pr ? '#fff' : future ? colors.text3 : isToday ? colors.accent : colors.text;
          return (
            <View key={d} style={styles.cell}>
              <Pressable
                disabled={!trained}
                accessibilityRole={trained ? 'button' : undefined}
                accessibilityLabel={`${d} ${monthName(month.m)}${trained ? `, trained${pr ? ', new PR' : ''}` : ''}`}
                onPress={() =>
                  list && router.push({ pathname: '/session/[id]', params: { id: list[0].id } })
                }
                style={[
                  styles.day,
                  {
                    backgroundColor: pr
                      ? colors.accent
                      : trained
                        ? colors.fillStrong
                        : 'transparent',
                  },
                  isToday && { borderWidth: 1.5, borderColor: colors.accent },
                ]}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: fg,
                    fontWeight: trained || isToday ? '600' : '400',
                  }}
                >
                  {d}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: 'rgba(118,118,128,0.30)' }]} />
          <Text style={type.small}>Trained</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text style={type.small}>New PR</Text>
        </View>
        <Text style={[type.small, { marginLeft: 'auto' }]}>
          {count} workout{count === 1 ? '' : 's'}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center' },
  weekday: { fontSize: 11, fontWeight: '600', color: colors.text2, height: 18 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
