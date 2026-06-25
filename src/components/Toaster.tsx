import { useToastStore } from '@/lib/toast-store';
import { Icon } from '@/components/Icon';
import './toaster.css';

/**
 * Componente raíz de notificaciones. Debe montarse una sola vez en App.tsx.
 * Los toasts se apilan en la esquina inferior derecha y desaparecen automáticamente.
 */
export function Toaster(): JSX.Element {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="toaster" role="region" aria-live="polite" aria-label="Notificaciones">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.variant}`} role="status">
          <span className="toast__message">{t.message}</span>
          <button
            className="toast__close"
            aria-label="Cerrar notificación"
            onClick={() => removeToast(t.id)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
