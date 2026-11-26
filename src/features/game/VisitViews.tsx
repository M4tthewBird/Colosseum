/**
 * Gym visits on Today: check in with the gym's QR poster when you arrive, check out when you
 * leave. Workouts in between are verified and earn more.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { MapPinCheck, ScanLine, ShieldCheck } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { useGym } from '@/features/social/api';
import { CodeScanner } from '@/features/together/TogetherViews';
import { clock } from '@/lib/together';
import { minutesText, STATUS_TEXT, visitStatus, type GymVisit } from '@/lib/game/visits';
import { useNow } from '@/lib/useNow';
import { useData } from '@/stores/data';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { useOpenVisit, useVisits } from './hooks';

/** The QR scanner in a sheet; a gym poster opens the visit screen. */
export function ScanSheet({
  visible,
  onClose,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {visible ? (
        <CodeScanner
          onCode={(path) => {
            onClose();
            router.push(path as never);
          }}
        />
      ) : null}
      <Text style={[type.caption, { textAlign: 'center', marginBottom: 8 }]}>
        Point the camera at the Colosseum poster at your gym’s desk.
      </Text>
    </Sheet>
  );
}

/** Today: check in or out. Shown once there is a home gym or a visit. */
export function VisitCard() {
  const homeGym = useData((s) => s.profile?.home_gym_id);
  const open = useOpenVisit();
  const visits = useVisits();
  const [scan, setScan] = useState(false);
  const now = useNow(true, 60000);
  const last = visits.find((v) => v.out_at && now - new Date(v.out_at).getTime() < 12 * 3600000);
  if (!homeGym && !visits.length) return null;

  return (
    <>
      <GlassCard radius={22} style={styles.card} accessibilityLabel="Gym check-in">
        {open ? (
          <OpenVisit visit={open} />
        ) : (
          <View style={styles.head}>
            <View style={styles.icon}>
              <MapPinCheck size={20} color={colors.accent} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong}>Training at the gym?</Text>
              <Text style={type.small}>
                Scan its QR code when you arrive and when you leave. Verified workouts earn more and
                count in wars.
              </Text>
            </View>
          </View>
        )}
        {!open && last ? <LastVisit visit={last} /> : null}
        <FillButton
          size="sm"
          icon={ScanLine}
          label={open ? 'Check out' : 'Check in'}
          onPress={() => setScan(true)}
        />
      </GlassCard>
      <ScanSheet
        visible={scan}
        onClose={() => setScan(false)}
        title={open ? 'Check out' : 'Check in'}
      />
    </>
  );
}

function OpenVisit({ visit }: { visit: GymVisit }) {
  const gym = useGym(visit.gym_id).data?.gym;
  const now = useNow(true, 30000);
  const minutes = Math.max(0, Math.round((now - new Date(visit.in_at).getTime()) / 60000));
  const checked = visit.in_ok === true;
  return (
    <View style={styles.head}>
      <View style={[styles.icon, { backgroundColor: accentA(0.1) }]}>
        <ShieldCheck size={20} color={colors.accent} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          At {gym?.name ?? 'the gym'} since {clock(new Date(visit.in_at))}
        </Text>
        <Text style={[type.small, tabular]}>
          {minutesText(minutes)} ·{' '}
          {visit.in_ok === false
            ? 'Check-in not verified'
            : checked
              ? 'Checked in'
              : 'Checking the scan…'}
          {' · '}closes by itself after 3 h
        </Text>
      </View>
    </View>
  );
}

function LastVisit({ visit }: { visit: GymVisit }) {
  const status = visitStatus(visit);
  const minutes = Math.round(
    (new Date(visit.out_at!).getTime() - new Date(visit.in_at).getTime()) / 60000,
  );
  return (
    <Text style={[type.small, tabular]}>
      Last visit: {minutesText(minutes)} ·{' '}
      <Text style={status === 'verified' ? { color: colors.accent, fontWeight: '600' } : undefined}>
        {STATUS_TEXT[status]}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
