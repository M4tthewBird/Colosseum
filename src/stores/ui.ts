/** Global toast and confirm dialog (Alert.alert has no buttons on web). */
import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface UiState {
  toast: { id: number; text: string; accent?: boolean } | null;
  confirm: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  showToast: (text: string, accent?: boolean) => void;
  hideToast: () => void;
  closeConfirm: (ok: boolean) => void;
}

export const useUi = create<UiState>()((set, get) => ({
  toast: null,
  confirm: null,
  showToast: (text, accent) => set({ toast: { id: Date.now(), text, accent } }),
  hideToast: () => set({ toast: null }),
  closeConfirm: (ok) => {
    get().confirm?.resolve(ok);
    set({ confirm: null });
  },
}));

export function toast(text: string, accent = false): void {
  useUi.getState().showToast(text, accent);
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useUi.setState({ confirm: { ...options, resolve } }));
}
