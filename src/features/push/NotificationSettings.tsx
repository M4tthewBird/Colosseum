/** Settings → Notifications: on or off for this device, why it cannot be on, and a test. */
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FieldHint, FormGroup, FormRow } from '@/components/Form';
import { Bell } from '@/components/icons';
import { Segmented } from '@/components/Segmented';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
import { disablePush, enablePush, sendTestPush, usePushState, type PushState } from './push';

const HINT: Record<PushState, string> = {
  on: 'This device gets notifications from Colosseum. Each phone or browser is turned on separately.',
  off: 'Turn on to get news from Colosseum on this device. More kinds are coming: training reminders and your friends.',
  blocked:
    'Notifications are blocked for Colosseum. Allow them in your phone’s or browser’s settings, then come back here.',
  'needs-install':
    'On iPhone, notifications work in the app on your Home Screen. Add Colosseum there first (Share → Add to Home Screen), then open it from the Home Screen.',
  unsupported: 'This browser cannot show notifications from Colosseum.',
};

export function NotificationSettings() {
  const { state, setState } = usePushState();
  const [busy, setBusy] = useState(false);
  if (state == null) return null;
  const canSwitch = state === 'on' || state === 'off';

  const change = async (on: boolean) => {
    setBusy(true);
    try {
      const next = on ? await enablePush() : await disablePush();
      setState(next);
      if (on && next === 'on') toast('Notifications on');
      if (on && next === 'blocked') toast('Notifications are blocked in your settings');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not turn notifications on');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const { sent } = await sendTestPush();
      toast(
        sent ? 'Sent. It should arrive in a moment.' : 'No device got it. Turn off and on again.',
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.caption, { paddingHorizontal: 16 }]}>Notifications</Text>
      <FormGroup>
        <FormRow label="On this device">
          {canSwitch ? (
            <Segmented
              compact
              height={30}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on', label: 'On' },
              ]}
              value={state === 'on' ? 'on' : 'off'}
              onChange={(v) => {
                if (!busy) void change(v === 'on');
              }}
              accessibilityLabel="Notifications on this device"
            />
          ) : (
            <Text style={[type.body, { fontSize: 16, color: colors.text2 }]}>
              {state === 'blocked' ? 'Blocked' : 'Not available'}
            </Text>
          )}
        </FormRow>
      </FormGroup>
      <FieldHint text={HINT[state]} />
      {state === 'on' ? (
        <FillButton
          label="Send a test notification"
          icon={Bell}
          disabled={busy}
          onPress={() => void test()}
        />
      ) : null}
    </View>
  );
}
