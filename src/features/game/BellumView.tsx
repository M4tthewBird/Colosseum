/**
 * City → Colosseum → Bellum: every month the gyms of a city fight. Score = days trained at the home gym
 * (verified visits) per active member, plus the gym's palisade. Also the gym (tribe) fortress.
 */
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { Crown, QrCode as QrIcon } from '@/components/icons';
import { EmptyState, ListGroup, ListRow } from '@/components/List';
import { useGym } from '@/features/social/api';
import { BELLUM, LAURELS } from '@/lib/game/config';
import { seasonDaysLeft, seasonName, seasonOf } from '@/lib/game/levels';
import { useData } from '@/stores/data';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import { useBellum, useGymManager } from './api';
import { MapRow } from './MapViews';
import { useMyVisitDaysThisMonth } from './hooks';

export function BellumView() {
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const gym = useGym(gymId).data?.gym;
  const manager = useGymManager(gymId);
  const myDays = useMyVisitDaysThisMonth();
  const bellum = useBellum(!!gymId, myDays);
  const days = seasonDaysLeft();

  if (!gymId)
    return (
      <EmptyState
        title="No home gym"
        text="Bellum is the monthly war of the gyms in your city. Pick your home gym in Settings to join it."
      />
    );

  const rows = bellum.data?.rows ?? [];
  const mine = rows.find((r) => r.gym_id === gymId);

  return (
    <View style={{ gap: 16 }}>
      <MapRow />
      <GlassCard radius={24} style={{ gap: 6, padding: 18 }}>
        <Text style={type.small}>
          Bellum · {seasonName(seasonOf(new Date()))} · {days} day{days === 1 ? '' : 's'} left
        </Text>
        <Text style={type.title} numberOfLines={1}>
          {mine?.score != null
            ? `#${mine.place} in ${gym?.city ?? 'your city'}`
            : (gym?.name ?? 'Your gym')}
        </Text>
        <Text style={type.caption}>
          Every day you train at {gym?.name ?? 'your gym'} with a verified visit counts for it. The
          gym with the most days per active member wins; its members get {LAURELS.bellumWin}{' '}
          laurels. You trained here {myDays} day{myDays === 1 ? '' : 's'} this month.
        </Text>
        {bellum.data?.lastWinner ? (
          <Text style={[type.small, { marginTop: 4 }]}>
            Last month’s winner:{' '}
            <Text style={{ fontWeight: '600', color: colors.text }}>{bellum.data.lastWinner}</Text>
          </Text>
        ) : null}
      </GlassCard>

      {!gym?.city ? (
        <EmptyState
          title="Your gym has no city"
          text="Bellum compares gyms in one city. The gym’s manager can add it."
        />
      ) : rows.length ? (
        <ListGroup>
          {rows.map((r) => {
            const me = r.gym_id === gymId;
            return (
              <ListRow
                key={r.gym_id}
                height={60}
                chevron={false}
                left={
                  <View
                    style={[
                      styles.place,
                      r.place === 1 && r.score != null && { backgroundColor: accentA(0.1) },
                    ]}
                  >
                    {r.place === 1 && r.score != null ? (
                      <Crown size={16} color={colors.accent} strokeWidth={2.2} />
                    ) : (
                      <Text style={[styles.placeText, tabular]}>
                        {r.score == null ? '–' : r.place}
                      </Text>
                    )}
                  </View>
                }
                title={
                  <Text style={[type.bodyStrong, me && { color: colors.accent }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                }
                subtitle={
                  r.score == null
                    ? `${r.active} active · needs ${BELLUM.minActive} to rank`
                    : `${r.visit_days} days · ${r.active} active${r.palisade ? ` · palisade +${r.palisade * 2} %` : ''}`
                }
                right={
                  <Text style={[type.bodyStrong, tabular]}>
                    {r.score == null ? '' : r.score.toFixed(2)}
                  </Text>
                }
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState
          title={
            bellum.isLoading ? 'Loading…' : bellum.isError ? 'Could not load' : 'No visits yet'
          }
          text={
            bellum.isError ? 'Are you online?' : 'Check in at your gym with its QR code to start.'
          }
        />
      )}

      {manager.data ? (
        <FillButton
          label="QR poster for the gym"
          icon={QrIcon}
          onPress={() => router.push({ pathname: '/gym-poster', params: { gymId } })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  place: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: { fontSize: 14, fontWeight: '700', color: colors.text2 },
});
