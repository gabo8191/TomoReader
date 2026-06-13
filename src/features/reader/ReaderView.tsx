import { useEffect } from 'react';
import { useReader } from './useReader';
import { useSettings } from '@/lib/settings-store';
import './reader.css';

interface ReaderViewProps {
  comicId: number;
  onClose: () => void;
}

export function ReaderView({ comicId, onClose }: ReaderViewProps): JSX.Element {
  const reader = useReader(comicId);
  const { fitMode, direction, brightness, warmth, showProgress } = useSettings();

  // Navegación por teclado. En RTL las flechas se invierten para mangas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const forward = direction === 'rtl' ? reader.prev : reader.next;
      const backward = direction === 'rtl' ? reader.next : reader.prev;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          forward();
          break;
        case 'ArrowLeft':
          backward();
          break;
        case 'Home':
          reader.goTo(0);
          break;
        case 'End':
          reader.goTo(reader.pageCount - 1);
          break;
        case 'Escape':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [direction, reader, onClose]);

  const fitClass = `reader__page--fit-${fitMode}`;
  // Filtro de comodidad visual: brillo reducido + calidez (menos luz azul).
  const imageFilter = `brightness(${brightness}) sepia(${warmth * 0.35}) saturate(${1 - warmth * 0.1})`;

  return (
    <div className="reader">
      <header className="reader__topbar">
        <button className="btn btn--ghost" onClick={onClose}>
          ← Biblioteca
        </button>
        <span className="reader__counter">
          {reader.pageCount > 0 ? `${reader.current + 1} / ${reader.pageCount}` : '—'}
        </span>
      </header>

      {/* Zonas de clic para avanzar/retroceder (respetan dirección de lectura). */}
      <button
        className="reader__zone reader__zone--left"
        onClick={direction === 'rtl' ? reader.next : reader.prev}
        aria-label="Página anterior"
      />
      <button
        className="reader__zone reader__zone--right"
        onClick={direction === 'rtl' ? reader.prev : reader.next}
        aria-label="Página siguiente"
      />

      <div className="reader__stage">
        {reader.loading && <div className="reader__msg">Abriendo cómic…</div>}
        {reader.error && <div className="reader__msg reader__msg--error">{reader.error}</div>}
        {!reader.loading && !reader.error && reader.src && (
          <img
            className={`reader__page ${fitClass}`}
            src={reader.src}
            alt={`Página ${reader.current + 1}`}
            style={{ filter: imageFilter }}
            draggable={false}
          />
        )}
        {!reader.loading && !reader.error && !reader.src && (
          <div className="reader__msg">Cargando página…</div>
        )}
      </div>

      {showProgress && reader.pageCount > 0 && (
        <div className="reader__scrubber">
          <input
            type="range"
            min={0}
            max={reader.pageCount - 1}
            value={reader.current}
            onChange={(e) => reader.goTo(Number(e.target.value))}
            /* En RTL invertimos visualmente el deslizador. */
            style={{ direction: direction === 'rtl' ? 'rtl' : 'ltr' }}
          />
        </div>
      )}
    </div>
  );
}
