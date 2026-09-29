/** Hidden dev route that shows every design-system component. Not linked from the app. */
import { Play, Plus, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton, IconButton, TextButton } from '@/components/Buttons';
import { ProgressBar, ProgressRing, Sparkline } from '@/components/Charts';
import { FormField, FormGroup, StepperRow } from '@/components/Form';
import { GlassCard } from '@/components/Glass';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Header, Screen } from '@/components/Screen';
import { Chip, Segmented } from '@/components/Segmented';
import { DEMO_USERS } from '@/dev/seed';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

export default function Components() {
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [chip, setChip] = useState('volume');
  const [weeks, setWeeks] = useState(8);
  return (
    <Screen tabs={false}>
      <Header
        above={<Wordmark />}
        title="Components"
        right={<IconButton icon={SlidersHorizontal} accessibilityLabel="Settings" />}
      />

      <SectionHeader title="Logo" />
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <LogoMark size={64} />
        <View style={{ backgroundColor: colors.accent, borderRadius: 14, padding: 8 }}>
          <LogoMark size={48} color="#fff" />
        </View>
        <Wordmark />
      </View>

      <SectionHeader title="Buttons" />
      <FillButton label="Start workout" icon={Play} iconFill onPress={() => toast('Pressed')} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <FillButton label="Programs" size="sm" />
        <IconButton icon={Plus} accessibilityLabel="Add" />
        <TextButton label="Change" />
        <TextButton label="Sign in" accent />
        <FillButton label="New PR" size="sm" onPress={() => toast('New PR · 100 kg × 3', true)} />
      </View>

      <SectionHeader title="Selection" />
      <Segmented
        options={[
          { value: 'a', label: 'Ranks' },
          { value: 'b', label: 'My gym' },
        ]}
        value={seg}
        onChange={setSeg}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {['volume', 'bench', 'squat', 'deadlift'].map((c) => (
          <Chip
            key={c}
            label={c[0].toUpperCase() + c.slice(1)}
            selected={chip === c}
            onPress={() => setChip(c)}
          />
        ))}
        <Chip label="Strength" selected check />
      </View>

      <SectionHeader title="Cards" />
      <GlassCard style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
        <ProgressRing value={0.75}>
          <Text style={[type.title, { fontSize: 20 }]}>3/4</Text>
          <Text style={{ fontSize: 10, color: colors.text2 }}>workouts</Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 12 }}>
          <Sparkline values={[83.6, 83.2, 83.4, 82.8, 82.6, 82.6, 82.4, 82.4]} />
          <ProgressBar value={0.28} />
        </View>
      </GlassCard>

      <SectionHeader title="List" />
      <ListGroup>
        {DEMO_USERS.slice(0, 3).map((u) => (
          <ListRow
            key={u.id}
            left={<Avatar name={u.display_name} size={38} />}
            title={u.display_name}
            subtitle={`@${u.username}`}
            onPress={() => {}}
          />
        ))}
      </ListGroup>

      <SectionHeader title="Avatars" />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {[34, 38, 54].map((s) => (
          <Avatar key={s} name="Matyáš Ptáček" size={s} />
        ))}
        <Avatar name="Tomáš Král" size={62} white ring={{ width: 2.5, color: colors.accent }} />
      </View>

      <SectionHeader title="Form" />
      <FormGroup>
        <FormField label="Name" placeholder="Your name" />
        <StepperRow
          label="Length"
          value={weeks}
          onChange={setWeeks}
          min={1}
          max={52}
          format={(w) => `${w} weeks`}
        />
      </FormGroup>
    </Screen>
  );
}
