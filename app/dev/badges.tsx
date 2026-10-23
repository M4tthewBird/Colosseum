/** Hidden dev route: every badge in every tier, plus its not-earned look. Not linked from the app. */
import { Text, View } from 'react-native';

import { SectionHeader } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { Medallion } from '@/features/badges/Medallion';
import { BADGES, badgeLevel } from '@/lib/badges';
import { colors } from '@/theme/tokens';

export default function Badges() {
  return (
    <Screen tabs={false}>
      <Header title="Badges" />
      {BADGES.map((b) => (
        <View key={b.id}>
          <SectionHeader title={`${b.name} · ${b.tiers.length} tiers`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            <Cell label="Not yet">
              <Medallion icon={b.icon} level={1} earned={false} value={b.tiers[0]} />
            </Cell>
            {b.tiers.map((t, i) => (
              <Cell key={t} label={`L${badgeLevel(i, b.tiers.length)} · ${b.tierTitle(t)}`}>
                <Medallion icon={b.icon} level={badgeLevel(i, b.tiers.length)} earned value={t} />
              </Cell>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 76, alignItems: 'center', gap: 2 }}>
      {children}
      <Text style={{ fontSize: 10, color: colors.text2, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
