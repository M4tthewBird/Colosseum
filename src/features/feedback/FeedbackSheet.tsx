/** Settings → Send feedback: a message to the admin, with a screenshot if the user wants. */
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { ImagePlus, X } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { pickImage } from '@/features/profile/avatar';
import { isDemo } from '@/lib/supabase';
import { toast } from '@/stores/ui';
import { colors } from '@/theme/tokens';
import { sendFeedback } from './report';

export function FeedbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({ kind: 'message', message, screenshotUri: shot });
      setMessage('');
      setShot(null);
      onClose();
      toast(isDemo ? 'Demo mode: nothing was sent' : 'Sent. Thank you!');
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setError(
        /fetch|network/i.test(text) ? 'No connection. Try again when you are online.' : text,
      );
    } finally {
      setBusy(false);
    }
  };

  const addShot = async () => {
    try {
      const picked = await pickImage();
      if (picked) setShot(picked.uri);
    } catch {
      toast('Could not open your photos');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Send feedback"
      doneLabel={busy ? 'Sending…' : 'Send'}
      doneDisabled={busy || !message.trim()}
      onDone={() => void send()}
    >
      <FormGroup>
        <FormField
          label="Message"
          value={message}
          onChangeText={setMessage}
          maxLength={2000}
          multiline
          placeholder="Something broken, confusing or missing? Tell us."
        />
      </FormGroup>
      {shot ? (
        <View style={styles.shot}>
          <Image source={{ uri: shot }} style={styles.image} resizeMode="cover" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove screenshot"
            onPress={() => setShot(null)}
            hitSlop={10}
            style={styles.remove}
          >
            <X size={14} color={colors.text} strokeWidth={2.6} />
          </Pressable>
        </View>
      ) : (
        <FillButton label="Add a screenshot" icon={ImagePlus} onPress={() => void addShot()} />
      )}
      {error ? <FieldHint text={error} error /> : null}
      <FieldHint text="Only the Colosseum team reads it. The app version, your phone model and the screen you were on are added, to help find the problem." />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  shot: { alignSelf: 'flex-start' },
  image: { width: 120, height: 200, borderRadius: 14, backgroundColor: colors.fill },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
