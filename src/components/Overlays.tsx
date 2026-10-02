import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUi } from '@/stores/ui';
import { dur, ease, easeIn, useReducedMotion } from '@/theme/motion';
import { colors, type } from '@/theme/tokens';
import { FillButton } from './Buttons';
import { Glass } from './Glass';

const TOAST_MS = 2400;

/** Small floating glass capsule at the top ("New PR", errors). Drops in, lifts out. */
export function ToastHost() {
  const t = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    if (!t) return;
    shown.value = 0;
    shown.value = withTiming(1, { duration: dur.state + 60, easing: ease });
    const out = setTimeout(() => {
      shown.value = withTiming(0, { duration: dur.tap + 40, easing: easeIn });
    }, TOAST_MS);
    const gone = setTimeout(hide, TOAST_MS + dur.tap + 60);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [t, hide, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: reduced ? [] : [{ translateY: (shown.value - 1) * 14 }],
  }));

  if (!t) return null;
  return (
    <View style={[{ pointerEvents: 'none' }, styles.toastWrap, { top: insets.top + 10 }]}>
      <Animated.View style={style}>
        <Glass radius={20} style={styles.toast} accessibilityLiveRegion="polite">
          {t.accent ? <View style={styles.dot} /> : null}
          <Text style={[type.bodyStrong, t.accent && { color: colors.accent }]}>{t.text}</Text>
        </Glass>
      </Animated.View>
    </View>
  );
}

/** Confirm dialog driven by confirm() in stores/ui. */
export function ConfirmHost() {
  const c = useUi((s) => s.confirm);
  const close = useUi((s) => s.closeConfirm);
  return (
    <Modal visible={!!c} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        {c ? (
          <View style={styles.dialog} accessibilityRole="alert">
            <Text style={[type.title, { fontSize: 19, textAlign: 'center' }]}>{c.title}</Text>
            {c.message ? (
              <Text style={[type.caption, { textAlign: 'center', fontSize: 15 }]}>{c.message}</Text>
            ) : null}
            <View style={{ gap: 8, marginTop: 6 }}>
              <FillButton
                label={c.confirmLabel ?? 'OK'}
                onPress={() => close(true)}
                labelStyle={c.destructive ? { color: colors.accent } : undefined}
              />
              <FillButton
                label={c.cancelLabel ?? 'Cancel'}
                onPress={() => close(false)}
                style={{ backgroundColor: 'transparent' }}
                labelStyle={{ color: colors.text2, fontWeight: '500' }}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 44 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 26,
    padding: 20,
    gap: 8,
    boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
  },
});
