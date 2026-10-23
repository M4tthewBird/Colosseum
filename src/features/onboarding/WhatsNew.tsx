/**
 * What's new: after an update, a sheet lists every release this device has not shown yet, day by
 * day (Settings → What's new keeps the full history). Waits for the tour and the Home Screen tip,
 * so a new user gets one thing at a time; new accounts start with everything marked seen.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { LogoMark } from '@/components/Logo';
import { Sheet } from '@/components/Sheet';
import { CHANGELOG } from '@/data/changelog';
import { seenMark, unseenReleases, type Release } from '@/lib/changelog';
import { fromLocalDate, shortDate, toLocalDate } from '@/lib/dates';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { colors, type } from '@/theme/tokens';
import { HighlightCard } from './Highlights';

export function WhatsNew() {
  // Before the stored prefs load, "nothing seen" would flash the sheet for everyone.
  const [hydrated, setHydrated] = useState(() => usePrefs.persist.hasHydrated());
  useEffect(() => usePrefs.persist.onFinishHydration(() => setHydrated(true)), []);

  const seen = usePrefs((s) => s.changelogSeen);
  const waiting = usePrefs((s) => s.tourPending || s.installTipPending);
  const setSeen = usePrefs((s) => s.setChangelogSeen);
  const lastWorkout = useData((s) => {
    let max = '';
    for (const id in s.sessions)
      if (s.sessions[id].started_at > max) max = s.sessions[id].started_at;
    return max;
  });
  // A device that never showed the changelog: the last workout stands in for the last visit.
  const since = lastWorkout ? toLocalDate(new Date(lastWorkout)) : null;
  const releases = useMemo(() => unseenReleases(CHANGELOG, seen, since), [seen, since]);
  const show = hydrated && !waiting && releases.length > 0;

  const close = () => setSeen(seenMark(CHANGELOG[0]));

  return (
    <Sheet visible={show} onClose={close} title="What’s new">
      <View style={styles.head}>
        <View style={styles.icon}>
          <LogoMark size={40} color="#fff" />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>New in Colosseum</Text>
      </View>
      <ReleaseList releases={releases} beforeShow={close} />
      <FillButton label="Got it" onPress={close} style={{ marginBottom: 8 }} />
    </Sheet>
  );
}

/** Each release: its big features as cards first, then the list of smaller changes. */
export function ReleaseList({
  releases,
  beforeShow,
}: {
  releases: Release[];
  /** Runs before a highlight's "Show me" leaves for the feature. */
  beforeShow?: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      {releases.map((r) => (
        <View key={r.id} style={{ gap: 12 }}>
          {r.highlights?.map((h) => (
            <HighlightCard key={h.feature} highlight={h} beforeShow={beforeShow} />
          ))}
          <Glass radius={20} style={styles.card}>
            <Text style={type.caption}>{shortDate(fromLocalDate(r.date))}</Text>
            <Text style={type.bodyStrong}>{r.highlights?.length ? 'Also new' : r.title}</Text>
            <View style={{ gap: 8, marginTop: 4 }}>
              {r.items.map((item, i) => (
                <View key={i} style={styles.item}>
                  <View style={styles.dot} />
                  <Text style={[type.body, { flex: 1 }]}>{item}</Text>
                </View>
              ))}
            </View>
          </Glass>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 2 },
  item: { flexDirection: 'row', gap: 10 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
});
