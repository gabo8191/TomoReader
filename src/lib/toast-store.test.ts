import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore, toast } from './toast-store';

describe('toast-store', () => {
  beforeEach(() => {
    // Limpia todos los toasts entre pruebas.
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrega un toast con la variante correcta', () => {
    toast.success('Operación completada');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.variant).toBe('success');
    expect(toasts[0]?.message).toBe('Operación completada');
  });

  it('agrega múltiples toasts apilados', () => {
    toast.info('Primero');
    toast.error('Segundo');
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it('elimina un toast por id', () => {
    toast.success('A borrar');
    const id = useToastStore.getState().toasts[0]?.id;
    expect(id).toBeDefined();
    useToastStore.getState().removeToast(id!);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-expira el toast tras la duración indicada', () => {
    toast.info('Efímero', 1000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('no expira el toast antes del tiempo indicado', () => {
    toast.info('Persistente', 2000);
    vi.advanceTimersByTime(1500);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('asigna IDs únicos a cada toast', () => {
    toast.success('Uno');
    toast.success('Dos');
    const ids = useToastStore.getState().toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });
});
