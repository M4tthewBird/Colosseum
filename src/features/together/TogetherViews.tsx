/**
 * Confirming a workout done together: after a workout one person shows a QR code, the other scans
 * it (in the app, or with the phone camera) and confirms. The Arena lists the newest ones.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { ScanLine, Users } from '@/components/icons';
import { SectionHeader } from '@/components/List';
import { QrCode } from '@/components/QrCode';
import { Sheet } from '@/components/Sheet';
import { TourTarget } from '@/features/onboarding/TourTarget';
import { timeAgo } from '@/lib/dates';
import { flush } from '@/lib/sync';
import { confirmOpen, goingText, readCode } from '@/lib/together';
import type { Session } from '@/lib/types';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
import { useSessionTogether, useTogetherFeed } from './api';

/** The link a training partner opens. */
export function togetherLink(sessionId: string): string {
  return Linking.createURL(`/together/${sessionId}`);
}

/** The card after a workout (shown while its code can still be confirmed). */
export function TogetherCard({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  if (!confirmOpen(session.finished_at)) return null;
  return (
    <>
      <Glass radius={22} style={styles.card}>
        <Text style={type.bodyStrong}>Trained with someone?</Text>
        <Text style={type.small}>
          Show your code or scan theirs. It counts for both of you in the Arena.
        </Text>
        <FillButton label="Confirm together" icon={Users} size="sm" onPress={() => setOpen(true)} />
      </Glass>
      {open ? <TogetherSheet sessionId={session.id} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TogetherSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [scanning, setScanning] = useState(false);
  const who = useSessionTogether(sessionId, !scanning);
  // The code only works once the finished workout has reached the server.
  useEffect(() => void flush().catch(() => {}), []);
  const names = (who.data ?? []).map((u) => u.display_name);

  return (
    <Sheet visible onClose={onClose} title="Trained together">
      {scanning ? (
        <CodeScanner
          onCode={(path) => {
            onClose();
            router.push(path as never);
          }}
        />
      ) : (
        <View style={styles.code}>
          <QrCode value={togetherLink(sessionId)} size={220} />
        </View>
      )}
      <Text style={[type.caption, { textAlign: 'center' }]}>
        {scanning
          ? 'Point the camera at the code on their phone.'
          : names.length
            ? `Confirmed: ${names.join(', ')}`
            : 'Your training partner scans this code, then taps Confirm.'}
      </Text>
      <FillButton
        label={scanning ? 'Show my code' : 'Scan their code'}
        icon={ScanLine}
        onPress={() => setScanning(!scanning)}
        style={{ marginBottom: 8 }}
      />
    </Sheet>
  );
}

/** The camera with a QR reader. Hands back the screen a code of ours leads to. */
function CodeScanner({ onCode }: { onCode: (path: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  if (!permission) return <View style={styles.camera} />;
  if (!permission.granted) {
    return (
      <View style={[styles.camera, styles.ask]}>
        <Text style={[type.caption, { textAlign: 'center' }]}>
          {permission.canAskAgain
            ? 'Colosseum needs the camera to read the code.'
            : 'The camera is blocked. Allow it for Colosseum in your settings.'}
        </Text>
        {permission.canAskAgain ? (
          <FillButton label="Allow camera" size="sm" onPress={() => void requestPermission()} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const code = readCode(data);
          if (!code) {
            toast('That is not a Colosseum code');
            return;
          }
          handled.current = true;
          onCode(
            code.kind === 'together'
              ? `/together/${code.id}`
              : `/add/${encodeURIComponent(code.username)}`,
          );
        }}
      />
    </View>
  );
}

/** "Trained together" in the Arena: who confirmed a workout together lately. */
export function TogetherFeed() {
  const myId = useData((s) => s.userId);
  const feed = useTogetherFeed();
  const list = feed.data ?? [];
  const label = (id: string, name: string) => (id === myId ? 'You' : name);
  return (
    <TourTarget id="arena-together" style={{ gap: 10, marginTop: 8 }}>
      <SectionHeader title="Trained together" />
      <Glass radius={22} style={styles.feed}>
        {list.length === 0 ? (
          <Text style={[type.small, { padding: 10 }]}>
            Trained with someone? Confirm it with a QR code after the workout and it shows up here.
          </Text>
        ) : (
          list.map((t) => (
            <View key={t.id} style={styles.row}>
              <View style={styles.pair} aria-hidden>
                <Avatar name={t.owner.display_name} url={t.owner.avatar_url} size={34} />
                <Avatar
                  name={t.user.display_name}
                  url={t.user.avatar_url}
                  size={34}
                  white
                  style={styles.second}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type.bodyStrong} numberOfLines={1}>
                  {goingNames(
                    label(t.owner.id, t.owner.display_name),
                    label(t.user.id, t.user.display_name),
                  )}
                </Text>
                <Text style={type.small}>{timeAgo(t.confirmed_at)}</Text>
              </View>
            </View>
          ))
        )}
      </Glass>
    </TourTarget>
  );
}

const goingNames = (a: string, b: string) => goingText([a, b], false);

const styles = StyleSheet.create({
  card: { padding: 16, gap: 8 },
  code: {
    alignSelf: 'center',
    padding: 12,
    borderRadius: 24,
    backgroundColor: colors.white,
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  camera: {
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.fill,
  },
  ask: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  feed: { padding: 4, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  pair: { flexDirection: 'row' },
  second: { marginLeft: -10 },
});
