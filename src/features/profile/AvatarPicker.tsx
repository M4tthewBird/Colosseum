/**
 * Profile picture sheet: a photo from the library, or an emoji on a soft tone. Returns a local
 * photo uri or an "emoji:…" value (see lib/avatars); uploadAvatar() handles both.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { Camera } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { AVATAR_EMOJIS, AVATAR_TONES, emojiAvatar, parseEmojiAvatar } from '@/lib/avatars';
import { colors, type } from '@/theme/tokens';
import { pickImage } from './avatar';

export function AvatarPicker({
  visible,
  name,
  current,
  onClose,
  onPick,
}: {
  visible: boolean;
  name: string;
  /** What is chosen now (photo uri/URL or emoji value), for the preview and the tone. */
  current: string | null;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const now = parseEmojiAvatar(current);
  const [emoji, setEmoji] = useState<string | null>(now?.emoji ?? null);
  const [tone, setTone] = useState(now?.tone ?? AVATAR_TONES[0]);
  const preview = emoji ? emojiAvatar(emoji, tone) : current;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Profile picture"
      doneLabel="Use"
      doneDisabled={!emoji}
      onDone={() => {
        if (emoji) onPick(emojiAvatar(emoji, tone));
        onClose();
      }}
    >
      <View style={styles.preview}>
        <Avatar name={name || '?'} url={preview} size={88} />
      </View>
      <FillButton
        label="Choose a photo"
        icon={Camera}
        onPress={async () => {
          const uri = await pickImage();
          if (!uri) return;
          onPick(uri);
          onClose();
        }}
      />
      <Text style={[type.caption, { textAlign: 'center' }]}>or pick an emoji</Text>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Emoji">
        {AVATAR_EMOJIS.map((e) => {
          const on = e === emoji;
          return (
            <Pressable
              key={e}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={e}
              onPress={() => setEmoji(e)}
              style={[styles.cell, { backgroundColor: on ? tone : colors.fill }, on && styles.on]}
            >
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tones} accessibilityRole="radiogroup" accessibilityLabel="Background">
        {AVATAR_TONES.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="radio"
            accessibilityState={{ checked: t === tone }}
            accessibilityLabel={`Background ${AVATAR_TONES.indexOf(t) + 1}`}
            onPress={() => setTone(t)}
            hitSlop={6}
            style={[styles.tone, { backgroundColor: t }, t === tone && styles.toneOn]}
          />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { borderWidth: 2, borderColor: colors.accent },
  emoji: { fontSize: 24, lineHeight: 30 },
  tones: { flexDirection: 'row', gap: 12, justifyContent: 'center', paddingBottom: 12 },
  tone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: colors.separator,
  },
  toneOn: { borderWidth: 2.5, borderColor: colors.accent },
});
