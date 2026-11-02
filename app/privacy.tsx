/** The privacy policy. Opens signed in or out. */
import { Text } from 'react-native';

import { BackLink } from '@/components/BackLink';
import { GlassCard } from '@/components/Glass';
import { Header, Screen } from '@/components/Screen';
import { PRIVACY_CONTACT, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '@/data/privacy';
import { type } from '@/theme/tokens';

export default function Privacy() {
  return (
    <Screen tabs={false} gap={14}>
      <BackLink label="Back" fallback="/" />
      <Header above={`Updated ${PRIVACY_UPDATED}`} title="Privacy" />
      {PRIVACY_CONTACT ? (
        <GlassCard style={{ gap: 6 }}>
          <Text style={type.bodyStrong}>Who is responsible</Text>
          <Text style={type.body}>
            {PRIVACY_CONTACT.name}, {PRIVACY_CONTACT.email}
          </Text>
        </GlassCard>
      ) : null}
      {PRIVACY_SECTIONS.map((s) => (
        <GlassCard key={s.title} style={{ gap: 6 }}>
          <Text style={type.bodyStrong}>{s.title}</Text>
          {s.paragraphs.map((p) => (
            <Text key={p} style={type.body}>
              {p}
            </Text>
          ))}
        </GlassCard>
      ))}
    </Screen>
  );
}
