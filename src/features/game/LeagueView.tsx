/** City → Colosseum → League: this season's laurels table for friends, the gym or everyone. */
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ProgressBar } from '@/components/Charts';
import { GlassCard } from '@/components/Glass';
import { EmptyState, ListGroup, ListRow, SectionHeader } from '@/components/List';
import { LAURELS } from '@/lib/game/config';
import { LEAGUES, leagueFor, nextLeague, seasonDaysLeft } from '@/lib/game/levels';
import { useData } from '@/stores/data';
import type { ArenaScope } from '@/stores/prefs';
import { colors, tabular, type } from '@/theme/tokens';
import { useLeague } from './api';
import { LeagueEmblem, seasonTitle } from './GameViews';
import { useMyGame } from './hooks';

export function LeagueView({ scope }: { scope: ArenaScope }) {
  const { season } = useMyGame();
  const myId = useData((s) => s.userId);
  const table = useLeague(scope, season.season, season.score);
  const league = leagueFor(season.score);
  const next = nextLeague(season.score);
  const rows = table.data ?? [];
  const days = seasonDaysLeft();

  return (
    <View style={{ gap: 16 }}>
      <GlassCard radius={24} style={styles.hero}>
        <LeagueEmblem league={league} size={64} />
        <Text style={type.title}>{league.name}</Text>
        <Text style={[type.caption, tabular]}>
          {seasonTitle(season.season)} · {days} day{days === 1 ? '' : 's'} left
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 4 }}>
          <ProgressBar
            value={next ? (season.score - league.from) / (next.from - league.from) : 1}
          />
          <View style={styles.between}>
            <Text style={[type.small, tabular]}>{Math.round(season.score)} laurels</Text>
            <Text style={[type.small, tabular]}>
              {next ? `${next.from - Math.round(season.score)} to ${next.name}` : 'Top league'}
            </Text>
          </View>
        </View>
        {season.carry ? (
          <Text style={[type.small, { textAlign: 'center' }]}>
            {season.carry} carried over from last season · {season.earned} from training
            {season.awards ? ` · ${season.awards} from duels and wars` : ''}
          </Text>
        ) : null}
      </GlassCard>

      <View style={styles.ladder}>
        {LEAGUES.map((l) => (
          <View
            key={l.id}
            style={[styles.step, l.id === league.id && styles.stepOn]}
            accessibilityLabel={`${l.name} from ${l.from} laurels`}
          >
            <Text
              style={[styles.stepName, l.id === league.id && { color: colors.text }]}
              numberOfLines={1}
            >
              {l.id === 'imperator' ? 'Imperator' : l.name}
            </Text>
            <Text style={[type.small, tabular]}>{l.from}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="This season" />
      {rows.length ? (
        <ListGroup>
          {rows.slice(0, 50).map((r) => {
            const mine = r.user_id === myId;
            return (
              <ListRow
                key={r.user_id}
                height={58}
                chevron={false}
                onPress={
                  mine
                    ? undefined
                    : () => router.push({ pathname: '/user/[id]', params: { id: r.user_id } })
                }
                left={
                  <View style={styles.rankCell}>
                    <Text style={[styles.rank, tabular, r.rank <= 3 && { color: colors.accent }]}>
                      {r.rank}
                    </Text>
                    <Avatar name={r.display_name} url={r.avatar_url} size={34} />
                  </View>
                }
                title={
                  <Text
                    style={[type.bodyStrong, mine && { color: colors.accent }]}
                    numberOfLines={1}
                  >
                    {mine ? 'You' : r.display_name}
                  </Text>
                }
                subtitle={leagueFor(r.value).name}
                right={<Text style={[type.bodyStrong, tabular]}>{Math.round(r.value)}</Text>}
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState
          title={
            table.isLoading ? 'Loading…' : table.isError ? 'Could not load' : 'No one here yet'
          }
          text={
            table.isError
              ? 'Are you online?'
              : scope === 'global'
                ? 'Join the global leaderboard in Settings to see everyone.'
                : 'Laurels come from training. Finish a workout to get on the table.'
          }
        />
      )}

      <GlassCard radius={22} style={{ gap: 6, padding: 16 }}>
        <Text style={type.bodyStrong}>How to earn laurels</Text>
        <Text style={type.caption}>
          {LAURELS.attendance} for training each day, +{LAURELS.verified} when verified at the gym,
          up to +{LAURELS.maxProgress} for getting stronger than you were (beginners and advanced
          lifters compete fairly), up to +{LAURELS.maxStrength} for strength, +
          {LAURELS.weeklyTarget} for hitting your weekly target. Duels, wars and Bellum add more. At
          most {LAURELS.dailyCap} a day from training.
        </Text>
        <Text style={type.caption}>
          A new season starts every month with half of your score (at most {LAURELS.maxCarry}).
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, padding: 20 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  ladder: { flexDirection: 'row', gap: 6 },
  step: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.fill,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  stepOn: { backgroundColor: colors.white, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
  stepName: { fontSize: 12, fontWeight: '600', color: colors.text2 },
  rankCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 22, textAlign: 'right', fontSize: 15, fontWeight: '700', color: colors.text2 },
});
