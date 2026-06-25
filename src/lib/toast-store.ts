import { create } from 'zustand';

/** Variantes visuales del toast. */
export type ToastVariant = 'success' | 'error' | 'info';

/** Una notificación no bloqueante. */
export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  /** Añade un toast y lo elimina automáticamente tras `durationMs` ms. */
  addToast: (message: string, variant: ToastVariant, durationMs?: number) => void;
  removeToast: (id: number) => void;
}

// Contador simple para IDs únicos sin dependencias externas.
let nextId = 1;

const DEFAULT_DURATION = 4000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast(message, variant, durationMs = DEFAULT_DURATION) {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    // Auto-cierre tras el tiempo indicado.
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
  },

  removeToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/**
 * API de conveniencia para disparar toasts desde cualquier hook o componente
 * sin necesidad de acceder al store directamente.
 */
export const toast = {
  success: (message: string, durationMs?: number) =>
    useToastStore.getState().addToast(message, 'success', durationMs),
  error: (message: string, durationMs?: number) =>
    useToastStore.getState().addToast(message, 'error', durationMs),
  info: (message: string, durationMs?: number) =>
    useToastStore.getState().addToast(message, 'info', durationMs),
};
