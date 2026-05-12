import { reactive, readonly } from 'vue';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmRequest {
  id: number;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (ok: boolean) => void;
}

const state = reactive({
  toasts: [] as Toast[],
  confirms: [] as ConfirmRequest[],
});

let nextId = 0;

function pushToast(message: string, kind: ToastKind = 'info', timeoutMs = 3500): number {
  const id = ++nextId;
  state.toasts = [...state.toasts, { id, kind, message }];
  if (timeoutMs > 0) {
    setTimeout(() => dismissToast(id), timeoutMs);
  }
  return id;
}

function dismissToast(id: number): void {
  state.toasts = state.toasts.filter((t) => t.id !== id);
}

function confirm(
  message: string,
  opts?: { confirmLabel?: string; cancelLabel?: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    state.confirms = [
      ...state.confirms,
      { id: ++nextId, message, confirmLabel: opts?.confirmLabel, cancelLabel: opts?.cancelLabel, resolve },
    ];
  });
}

function resolveConfirm(id: number, ok: boolean): void {
  const req = state.confirms.find((c) => c.id === id);
  if (!req) return;
  req.resolve(ok);
  state.confirms = state.confirms.filter((c) => c.id !== id);
}

export function useNotification() {
  return {
    state: readonly(state),
    toast: (m: string, opts?: { kind?: ToastKind; timeoutMs?: number }) =>
      pushToast(m, opts?.kind ?? 'info', opts?.timeoutMs ?? 3500),
    success: (m: string) => pushToast(m, 'success'),
    error: (m: string) => pushToast(m, 'error', 5000),
    dismiss: dismissToast,
    confirm,
    resolveConfirm,
  };
}
