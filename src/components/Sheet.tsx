import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, type } from '@/theme/tokens';
import { TextButton } from './Buttons';
import { MAX_WIDTH } from './Screen';

/** Bottom sheet (popup) with an optional Cancel / title / Done bar. */
export function Sheet({
  visible,
  onClose,
  title,
  doneLabel,
  onDone,
  doneDisabled,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  doneLabel?: string;
  onDone?: () => void;
  doneDisabled?: boolean;
  children: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          {title || onDone ? (
            <View style={styles.bar}>
              <TextButton label="Cancel" onPress={onClose} style={styles.barSide} />
              <Text style={[type.bodyStrong, { fontSize: 17 }]} numberOfLines={1}>
                {title}
              </Text>
              <View style={[styles.barSide, { alignItems: 'flex-end' }]}>
                {onDone ? (
                  <TextButton
                    label={doneLabel ?? 'Done'}
                    accent
                    onPress={onDone}
                    disabled={doneDisabled}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
          {scroll ? (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, { flexShrink: 1 }]}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '90%',
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(60,60,67,0.25)',
    marginTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
  },
  barSide: { width: 80 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
});
