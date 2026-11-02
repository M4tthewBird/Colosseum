/** Today, after a break: a friendly word and a short workout, never a streak back at zero. */
import { router } from 'expo-router';
import { Text } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { Zap } from '@/components/icons';
import { durationText, type Break } from '@/lib/progress';
import { usePrefs } from '@/stores/prefs';
import { type } from '@/theme/tokens';

export function ComebackCard({ away }: { away: Break }) {
  const hidden = usePrefs((s) => s.comebackHidden === away.lastSessionId);
  const hide = usePrefs((s) => s.setComebackHidden);
  if (hidden) return null;
  return (
    <GlassCard radius={22} style={{ gap: 8, padding: 16 }} accessibilityLabel="Welcome back">
      <Text style={type.title}>Welcome back</Text>
      <Text style={type.caption}>
        It has been {durationText(away.days)}, and that is fine. No catching up needed: a short
        workout with lighter weights is a great way back.
      </Text>
      <FillButton
        label="Short workout, 30 min"
        icon={Zap}
        onPress={() =>
          router.push({ pathname: '/generate', params: { preset: 'full', minutes: '30' } })
        }
      />
      <TextButton
        label="Not now"
        style={{ alignSelf: 'center' }}
        onPress={() => hide(away.lastSessionId)}
      />
    </GlassCard>
  );
}
