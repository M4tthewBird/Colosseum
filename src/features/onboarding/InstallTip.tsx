/**
 * "Add Colosseum to your Home Screen" — shown once, right after sign-up, on the web build only
 * (not when the app already runs installed). Steps match the visitor's platform; on Android
 * Chrome and desktop Chrome/Edge the browser's own install prompt is offered as a button.
 */
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { Download, EllipsisVertical, Share, SquarePlus, type LucideIcon } from '@/components/icons';
import { LogoMark } from '@/components/Logo';
import { Sheet } from '@/components/Sheet';
import { usePrefs } from '@/stores/prefs';
import { colors, type } from '@/theme/tokens';

type Kind = 'ios' | 'android' | 'desktop';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The browser fires this once, early; keep it until the tip is shown.
let deferred: InstallPromptEvent | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
}

function isInstalled(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function platformKind(): Kind {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const STEPS: Record<Kind, { icon: LucideIcon; text: string }[]> = {
  ios: [
    { icon: Share, text: 'In Safari, tap the Share button in the toolbar.' },
    { icon: SquarePlus, text: 'Scroll down and tap “Add to Home Screen”.' },
    { icon: Download, text: 'Tap “Add”. Open Colosseum from your Home Screen from now on.' },
  ],
  android: [
    { icon: EllipsisVertical, text: 'In Chrome, tap the ⋮ menu in the top right.' },
    { icon: SquarePlus, text: 'Tap “Add to Home screen” or “Install app”.' },
    { icon: Download, text: 'Confirm. Colosseum opens like a normal app from now on.' },
  ],
  desktop: [
    {
      icon: Download,
      text: 'In Chrome or Edge, click the install icon at the right end of the address bar.',
    },
    { icon: SquarePlus, text: 'Click “Install”. Colosseum gets its own window and icon.' },
  ],
};

export function InstallTip() {
  const pending = usePrefs((s) => s.installTipPending);
  const done = usePrefs((s) => s.setInstallTipPending);
  const [kind] = useState<Kind>(platformKind);
  const [canPrompt, setCanPrompt] = useState(false);
  const show = pending && Platform.OS === 'web' && !isInstalled();

  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => setCanPrompt(!!deferred), 500);
    return () => clearInterval(id);
  }, [show]);

  // Nothing to show here (native app, or already installed): clear the flag.
  useEffect(() => {
    if (pending && !show) done(false);
  }, [pending, show, done]);

  const close = () => done(false);

  return (
    <Sheet visible={show} onClose={close} title="Add to Home Screen">
      <View style={styles.head}>
        <View style={styles.icon}>
          <LogoMark size={40} color="#fff" />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>Put Colosseum on your Home Screen</Text>
        <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>
          It opens full screen like a real app and lets you log workouts even without signal.
        </Text>
      </View>

      {kind !== 'ios' && canPrompt ? (
        <FillButton
          label="Install Colosseum"
          icon={Download}
          ready
          onPress={async () => {
            const e = deferred;
            deferred = null;
            setCanPrompt(false);
            if (!e) return;
            await e.prompt();
            await e.userChoice.catch(() => null);
            close();
          }}
        />
      ) : null}

      <Glass radius={20} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        {STEPS[kind].map((s, i) => {
          const Icon = s.icon;
          return (
            <View key={i} style={styles.step}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text style={[type.body, { flex: 1 }]}>{s.text}</Text>
              <Icon size={20} color={colors.accent} strokeWidth={2} />
            </View>
          );
        })}
      </Glass>
      {kind === 'ios' ? (
        <Text style={[type.small, { textAlign: 'center' }]}>
          Only Safari can add apps to the Home Screen on iPhone.
        </Text>
      ) : null}
      <FillButton label="Got it" onPress={close} style={{ marginBottom: 8 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontSize: 13, fontWeight: '700', color: colors.text },
});
