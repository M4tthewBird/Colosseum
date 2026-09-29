import { router } from 'expo-router';
import { Check, ChevronDown, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FillButton, IconButton } from '@/components/Buttons';
import { ListGroup, ListRow } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { MyGym } from '@/features/arena/MyGym';
import { Ranks } from '@/features/arena/Ranks';
import { useCheckIn, useFriends, useGym, useMyCheckin } from '@/features/social/api';
import { useData } from '@/stores/data';
import { usePrefs, type ArenaPeriod } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

const PERIODS: { value: ArenaPeriod; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

export default function Arena() {
  const [section, setSection] = useState<'ranks' | 'gym'>('ranks');
  const profile = useData((s) => s.profile);
  const friends = useFriends();
  const friendCount = friends.data?.friends.length ?? 0;
  const incoming = friends.data?.incoming.length ?? 0;
  const gymId = profile?.home_gym_id ?? null;
  const gym = useGym(gymId);

  const above =
    section === 'ranks'
      ? `${friendCount} friend${friendCount === 1 ? '' : 's'}`
      : gym.data?.gym
        ? `${gym.data.gym.name} · ${gym.data.members} member${gym.data.members === 1 ? '' : 's'}`
        : 'No home gym';

  return (
    <Screen
      glow={section === 'ranks' ? 'center' : 'right'}
      glowTop={section === 'ranks' ? 200 : -120}
      gap={16}
    >
      <Header
        above={above}
        title="Arena"
        right={
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View>
              <IconButton
                icon={Users}
                accessibilityLabel="Friends"
                onPress={() => router.push('/arena/friends')}
              />
              {incoming > 0 ? <View style={styles.badge} /> : null}
            </View>
            {section === 'ranks' ? <PeriodMenu /> : gymId ? <CheckInButton gymId={gymId} /> : null}
          </View>
        }
      />
      <Segmented
        options={[
          { value: 'ranks', label: 'Ranks' },
          { value: 'gym', label: 'My gym' },
        ]}
        value={section}
        onChange={setSection}
        accessibilityLabel="Arena sections"
      />
      {section === 'ranks' ? (
        <Ranks friendCount={friends.isLoading ? 1 : friendCount} />
      ) : (
        <MyGym gymId={gymId} />
      )}
    </Screen>
  );
}

function PeriodMenu() {
  const period = usePrefs((s) => s.arenaPeriod);
  const setPeriod = usePrefs((s) => s.setArenaPeriod);
  const [open, setOpen] = useState(false);
  const label = PERIODS.find((p) => p.value === period)?.label ?? 'This week';
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Change period, ${label}`}
        onPress={() => setOpen(true)}
        style={styles.period}
      >
        <Text style={[type.bodyStrong]}>{label}</Text>
        <ChevronDown size={12} color={colors.text} strokeWidth={3} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Period">
        <ListGroup>
          {PERIODS.map((p) => (
            <ListRow
              key={p.value}
              height={50}
              title={p.label}
              chevron={false}
              right={
                p.value === period ? (
                  <Check size={18} color={colors.accent} strokeWidth={2.6} />
                ) : null
              }
              onPress={() => {
                setPeriod(p.value);
                setOpen(false);
              }}
            />
          ))}
        </ListGroup>
      </Sheet>
    </>
  );
}

function CheckInButton({ gymId }: { gymId: string }) {
  const mine = useMyCheckin();
  const checkIn = useCheckIn();
  const checked = !!mine.data;
  return (
    <FillButton
      size="sm"
      label={checked ? 'Checked in' : 'Check in'}
      icon={checked ? Check : undefined}
      disabled={checkIn.isPending}
      accessibilityState={{ selected: checked }}
      onPress={() => {
        if (checked) {
          toast('You are checked in for 2 hours');
          return;
        }
        checkIn.mutate(gymId, { onError: (e) => toast(e.message) });
      }}
    />
  );
}

const styles = StyleSheet.create({
  period: {
    height: 36,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: colors.fill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
});
