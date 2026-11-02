/** Change password: asks for the current one, so a phone left open cannot lock its owner out. */
import { useState } from 'react';
import { View } from 'react-native';

import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Sheet } from '@/components/Sheet';
import { changePassword } from '@/features/auth/auth';
import { toast } from '@/stores/ui';

export function ChangePassword({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setCurrent('');
    setNext('');
    setAgain('');
    setError(null);
    onClose();
  };

  const save = async () => {
    if (busy) return;
    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('The new password needs at least 8 characters.');
    if (next !== again) return setError('The new passwords do not match.');
    setError(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      toast('Password changed');
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Change password"
      doneLabel="Save"
      onDone={() => void save()}
      doneDisabled={busy}
    >
      <View style={{ gap: 10, paddingBottom: 12 }}>
        <FormGroup>
          <FormField
            label="Current"
            labelWidth={84}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            accessibilityLabel="Current password"
          />
          <FormField
            label="New"
            labelWidth={84}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            accessibilityLabel="New password"
          />
          <FormField
            label="Again"
            labelWidth={84}
            value={again}
            onChangeText={setAgain}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            accessibilityLabel="New password again"
          />
        </FormGroup>
        {error ? <FieldHint text={error} error /> : null}
      </View>
    </Sheet>
  );
}
