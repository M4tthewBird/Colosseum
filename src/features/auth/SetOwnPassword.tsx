/**
 * After signing in with a temporary password from the admin: the user chooses their own before
 * going on. It cannot be closed; the admin knows the temporary one, so it must not stay.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { KeyRound } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
import { setOwnPassword, useMustChangePassword } from './password';

export function SetOwnPassword() {
  const must = useMustChangePassword();
  const userId = useData((s) => s.userId);
  const qc = useQueryClient();
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (next.length < 8) return setError('The password needs at least 8 characters.');
    if (next !== again) return setError('The passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await setOwnPassword(next);
      qc.setQueryData(['must-change-password', userId], false);
      toast('Password set');
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(
        /fetch|network/i.test(text) ? 'No connection. Try again when you are online.' : text,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={must} onClose={() => {}} title="New password">
      <View style={styles.head}>
        <View style={styles.icon}>
          <KeyRound size={26} color={colors.accent} strokeWidth={2} />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>Choose your own password</Text>
        <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
          You signed in with a temporary password. Set your own to keep going.
        </Text>
      </View>
      <FormGroup>
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
          onSubmitEditing={() => void save()}
        />
      </FormGroup>
      {error ? <FieldHint text={error} error /> : null}
      <FillButton
        label="Save password"
        loading={busy}
        disabled={busy}
        ready={next.length >= 8 && next === again}
        onPress={() => void save()}
        style={{ marginBottom: 8 }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
