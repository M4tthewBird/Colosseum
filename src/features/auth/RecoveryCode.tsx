/**
 * The recovery code: made on the server, shown here once, to keep somewhere safe. With it the
 * password can be reset from the sign-in screen (see password.ts). Asked for on Today after the
 * other first-run prompts; Settings → Account → Recovery code makes a new one.
 */
import { useEffect, useState } from 'react';
import { Platform, Share as RNShare, StyleSheet, Text, View } from 'react-native';

import { FillButton, TextButton } from '@/components/Buttons';
import { FieldHint } from '@/components/Form';
import { Copy, KeyRound, Share } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { CHANGELOG } from '@/data/changelog';
import { useSpotlight } from '@/features/onboarding/Spotlight';
import { hasPicture } from '@/lib/avatars';
import { unseenReleases } from '@/lib/changelog';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
import { newRecoveryCode, useHasRecoveryCode, useRecoveryCodeSaved } from './password';

async function copyText(text: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } else await RNShare.share({ message: text });
  } catch {
    toast('Could not copy. Write it down instead.');
  }
}

async function shareCode(code: string, username: string): Promise<void> {
  const text = `Colosseum recovery code for @${username}: ${code}`;
  try {
    if (Platform.OS === 'web') {
      if (navigator.share) await navigator.share({ title: 'Colosseum recovery code', text });
      else await copyText(text);
    } else await RNShare.share({ message: text });
  } catch {
    // Closed the share sheet.
  }
}

/**
 * Makes a code and shows it. `replacing`: the account has one already, which stops working.
 * `onLater` adds a Later button (the Today prompt).
 */
export function RecoveryCodeSheet({
  visible,
  onClose,
  replacing,
  onLater,
}: {
  visible: boolean;
  onClose: () => void;
  replacing?: boolean;
  onLater?: () => void;
}) {
  const username = useData((s) => s.profile?.username ?? '');
  const saved = useRecoveryCodeSaved();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh start next time: an old code on screen would be confusing.
  const close = (then: () => void) => () => {
    setCode(null);
    setError(null);
    then();
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setCode(await newRecoveryCode());
      saved();
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
    <Sheet visible={visible} onClose={close(onClose)} title="Recovery code">
      <View style={styles.head}>
        <View style={styles.icon}>
          <KeyRound size={26} color={colors.accent} strokeWidth={2} />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>
          {code ? 'Keep this code safe' : 'If you ever forget your password'}
        </Text>
        <Text style={[type.caption, styles.lead]}>
          {code
            ? 'With it you can set a new password on the sign-in screen. It is shown only now, and works once.'
            : 'Colosseum does not use email. A recovery code lets you set a new password yourself. Save it in your notes or password manager.'}
        </Text>
      </View>

      {code ? (
        <>
          <View style={styles.codeBox} accessible accessibilityLabel={`Recovery code ${code}`}>
            <Text style={styles.code} selectable>
              {code}
            </Text>
          </View>
          <View style={styles.row}>
            <FillButton
              label="Copy"
              icon={Copy}
              style={{ flex: 1 }}
              onPress={() => void copyText(code)}
            />
            <FillButton
              label="Share"
              icon={Share}
              style={{ flex: 1 }}
              onPress={() => void shareCode(code, username)}
            />
          </View>
          <FillButton label="I saved it" onPress={close(onClose)} style={{ marginBottom: 8 }} />
        </>
      ) : (
        <>
          {replacing ? (
            <FieldHint text="Your current code stops working when you make a new one." />
          ) : null}
          {error ? <FieldHint text={error} error /> : null}
          <FillButton
            label={replacing ? 'Make a new code' : 'Make my code'}
            icon={KeyRound}
            loading={busy}
            disabled={busy}
            onPress={() => void create()}
          />
          {onLater ? (
            <TextButton label="Later" style={styles.later} onPress={close(onLater)} />
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const WEEK = 7 * 86400000;

/** On Today, for accounts without a code, after the other first-run prompts. */
export function RecoveryPrompt() {
  const [hydrated, setHydrated] = useState(() => usePrefs.persist.hasHydrated());
  useEffect(() => usePrefs.persist.onFinishHydration(() => setHydrated(true)), []);
  const has = useHasRecoveryCode();
  const profile = useData((s) => s.profile);
  const askedAt = usePrefs((s) => s.recoveryAskedAt);
  const avatarAskedAt = usePrefs((s) => s.avatarAskedAt);
  const busy = usePrefs(
    (s) =>
      s.tourPending ||
      s.installTipPending ||
      unseenReleases(CHANGELOG, s.changelogSeen).length > 0 ||
      (!profile?.home_gym_id && !s.homeGymAsked),
  );
  const spotlight = useSpotlight((s) => !!s.current);
  const setAskedAt = usePrefs((s) => s.setRecoveryAskedAt);
  const [now] = useState(() => Date.now());
  const [open, setOpen] = useState(true);
  const due = !askedAt || now - new Date(askedAt).getTime() > WEEK;
  // The profile picture prompt goes first when it is due.
  const avatarFirst =
    !!profile &&
    !hasPicture(profile.avatar_url) &&
    (!avatarAskedAt || now - new Date(avatarAskedAt).getTime() > WEEK);
  const ready = hydrated && has === false && due && !busy && !spotlight && !avatarFirst;
  // Once open it stays open: making the code gives the account one, which would close the sheet
  // before the code could be copied.
  const [shown, setShown] = useState(false);
  if (ready && open && !shown) setShown(true);
  const later = () => {
    setAskedAt(new Date().toISOString());
    setOpen(false);
    setShown(false);
  };

  return <RecoveryCodeSheet visible={shown} onClose={later} onLater={later} />;
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
  lead: { textAlign: 'center', fontSize: 15 },
  codeBox: {
    borderRadius: 18,
    backgroundColor: colors.white,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.separator,
  },
  code: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.text,
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, Menlo, monospace' : 'Menlo',
  },
  row: { flexDirection: 'row', gap: 8 },
  later: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
});
