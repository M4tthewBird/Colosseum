import { BackLink } from '@/components/BackLink';
import { Header, Screen } from '@/components/Screen';
import { CHANGELOG } from '@/data/changelog';
import { ReleaseList } from '@/features/onboarding/WhatsNew';

export default function WhatsNewScreen() {
  return (
    <Screen gap={16}>
      <BackLink label="Settings" fallback="/profile/settings" />
      <Header title="What’s new" />
      <ReleaseList releases={CHANGELOG} />
    </Screen>
  );
}
