/**
 * Sign in → Forgot password? With the recovery code: a new password right here, then signed in.
 * Without it: a request to the admin, who gets back to the user on the contact they leave.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { cleanUsername } from '@/lib/supabase';
import { toast } from '@/stores/ui';
import { requestPasswordHelp, resetWithCode } from './password';

type Way = 'code' | 'ask';

export function ForgotPassword({
  visible,
  onClose,
  username: initialUsername,
}: {
  visible: boolean;
  onClose: () => void;
  /** What was typed on the sign-in screen already. */
  username: string;
}) {
  const [way, setWay] = useState<Way>('code');
  const [username, setUsername] = useState(initialUsername);
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = () => {
    setCode('');
    setNext('');
    setAgain('');
    setError(null);
    setSent(false);
    onClose();
  };

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!username) return setError('Enter your username.');
    if (code.replace(/[^a-z0-9]/gi, '').length !== 16)
      return setError('The recovery code has 16 letters and numbers.');
    if (next.length < 8) return setError('The new password needs at least 8 characters.');
    if (next !== again) return setError('The new passwords do not match.');
    void run(async () => {
      await resetWithCode(username, code, next);
      toast('New password set. Make a new recovery code in Settings.');
      close();
    });
  };

  const ask = () => {
    if (!username) return setError('Enter your username.');
    if (contact.trim().length < 3) return setError('Tell us how we can reach you.');
    void run(async () => {
      await requestPasswordHelp(username, contact);
      setSent(true);
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Forgot password"
      doneLabel={sent ? undefined : way === 'code' ? 'Reset' : 'Send'}
      doneDisabled={busy}
      onDone={sent ? undefined : way === 'code' ? reset : ask}
    >
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {sent ? (
          <>
            <FieldHint text="Sent. The Colosseum admin will get back to you with a temporary password. After signing in with it, you choose your own." />
            <FillButton label="Done" onPress={close} />
          </>
        ) : (
          <>
            <Segmented
              options={[
                { value: 'code', label: 'I have my code' },
                { value: 'ask', label: 'I don’t' },
              ]}
              value={way}
              onChange={(w) => {
                setWay(w);
                setError(null);
              }}
              accessibilityLabel="Do you have your recovery code?"
            />
            <FormGroup>
              <FormField
                label="Username"
                labelWidth={104}
                value={username}
                onChangeText={(t) => setUsername(cleanUsername(t))}
                placeholder="@username"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
              />
              {way === 'code' ? (
                <>
                  <FormField
                    label="Code"
                    labelWidth={104}
                    value={code}
                    onChangeText={(t) => setCode(t.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Recovery code"
                  />
                  <FormField
                    label="New"
                    labelWidth={104}
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
                    labelWidth={104}
                    value={again}
                    onChangeText={setAgain}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    accessibilityLabel="New password again"
                  />
                </>
              ) : (
                <FormField
                  label="Reach me"
                  labelWidth={104}
                  value={contact}
                  onChangeText={setContact}
                  maxLength={200}
                  placeholder="Instagram, phone, email…"
                  autoCapitalize="none"
                  accessibilityLabel="How we can reach you"
                />
              )}
            </FormGroup>
            {error ? <FieldHint text={error} error /> : null}
            <FieldHint
              text={
                way === 'code'
                  ? 'The code you saved when you made your account, or later in Settings. It works once.'
                  : 'The Colosseum admin sets a temporary password and sends it to you there. After signing in with it, you choose your own.'
              }
            />
          </>
        )}
      </View>
    </Sheet>
  );
}
