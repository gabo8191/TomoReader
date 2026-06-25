import { useCallback, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { Comic, Pocket } from '@/types';

interface ComicGridProps {
  comics: Comic[];
  pockets: Pocket[];
  loading: boolean;
  onOpen: (comic: Comic) => void;
  onMove: (comicId: number, pocketId: number | null) => void;
  onDelete: (comicId: number) => void;
  /** Se dispara al pulsar el CTA de importar desde el estado vacío. */
  onImport?: () => void;
  /**
   * Contexto del estado vacío:
   * - 'library': la biblioteca completa está vacía (primer uso).
   * - 'filter': hay cómics pero el filtro activo no muestra ninguno.
   */
  emptyContext?: 'library' | 'filter';
}

/**
 * Grilla de cómics con navegación por teclado (roving tabindex).
 * Flechas izquierda/derecha/arriba/abajo mueven el foco; Enter abre el libro.
 * El estado vacío diferencia el primer uso del filtro sin resultados.
 */
export function ComicGrid({
  comics,
  pockets,
  loading,
  onOpen,
  onMove,
  onDelete,
  onImport,
  emptyContext = 'library',
}: ComicGridProps): JSX.Element {
  // Índice de la card con tabIndex=0 (roving tabindex).
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Número de columnas inferido en tiempo real del DOM para la navegación vertical.
  const gridRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return <div className="grid__state">Cargando biblioteca…</div>;
  }

  if (comics.length === 0) {
    return emptyContext === 'library' ? (
      // ── Estado vacío: primera visita o biblioteca vacía ──────────────────
      <div className="grid__state grid__onboarding" role="status" aria-live="polite">
        <Icon name="book" size={48} className="grid__onboarding-icon" />
        <p className="grid__onboarding-title">Tu biblioteca está vacía</p>
        <p className="grid__hint">Importa archivos CBR, CBZ, PDF o EPUB para empezar a leer.</p>
        {onImport && (
          <button className="btn btn--primary grid__onboarding-cta" onClick={onImport}>
            <Icon name="plus" size={18} />
            Importar libros
          </button>
        )}
      </div>
    ) : (
      // ── Sin resultados con filtros activos ───────────────────────────────
      <div className="grid__state" role="status" aria-live="polite">
        <Icon name="folder" size={36} className="grid__onboarding-icon" />
        <p>No hay resultados con los filtros actuales.</p>
        <p className="grid__hint">Prueba a cambiar el formato, la fecha o el orden.</p>
      </div>
    );
  }

  return (
    <GridContent
      comics={comics}
      pockets={pockets}
      focusedIndex={focusedIndex}
      setFocusedIndex={setFocusedIndex}
      gridRef={gridRef}
      onOpen={onOpen}
      onMove={onMove}
      onDelete={onDelete}
    />
  );
}

// Componente interno para separar la lógica de teclado del render condicional.
interface GridContentProps {
  comics: Comic[];
  pockets: Pocket[];
  focusedIndex: number;
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
  gridRef: React.RefObject<HTMLDivElement>;
  onOpen: (comic: Comic) => void;
  onMove: (comicId: number, pocketId: number | null) => void;
  onDelete: (comicId: number) => void;
}

function GridContent({
  comics,
  pockets,
  focusedIndex,
  setFocusedIndex,
  gridRef,
  onOpen,
  onMove,
  onDelete,
}: GridContentProps): JSX.Element {
  /**
   * Calcula el número de columnas del grid en tiempo real mirando el primer ítem.
   * Usado para la navegación vertical con flechas arriba/abajo.
   */
  const getColumnCount = useCallback((): number => {
    const grid = gridRef.current;
    if (!grid) return 1;
    const firstCard = grid.querySelector<HTMLElement>('.card');
    if (!firstCard) return 1;
    const gridLeft = grid.getBoundingClientRect().left;
    const cardLeft = firstCard.getBoundingClientRect().left;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const availableWidth = grid.clientWidth;
    // Estimación: cuántas columnas caben dado el ancho de la primera card.
    const gap = cardLeft - gridLeft;
    return Math.max(1, Math.round((availableWidth + gap) / (cardWidth + gap)));
  }, [gridRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const cols = getColumnCount();
      let next: number | null = null;

      switch (e.key) {
        case 'ArrowRight':
          next = Math.min(index + 1, comics.length - 1);
          break;
        case 'ArrowLeft':
          next = Math.max(index - 1, 0);
          break;
        case 'ArrowDown':
          next = Math.min(index + cols, comics.length - 1);
          break;
        case 'ArrowUp':
          next = Math.max(index - cols, 0);
          break;
        default:
          return;
      }

      if (next !== null && next !== index) {
        e.preventDefault();
        setFocusedIndex(next);
        // Mueve el foco al botón de portada de la card siguiente.
        const grid = gridRef.current;
        const cards = grid?.querySelectorAll<HTMLElement>('.card__cover');
        cards?.[next]?.focus();
      }
    },
    [comics.length, getColumnCount, gridRef, setFocusedIndex],
  );

  return (
    <div ref={gridRef} className="grid" role="list" aria-label="Biblioteca">
      {comics.map((comic, index) => {
        const progress = comic.pageCount > 0 ? (comic.lastPage + 1) / comic.pageCount : 0;
        return (
          <article key={comic.id} className="card" role="listitem">
            {/*
             * Roving tabindex: solo la card enfocada tiene tabIndex=0;
             * las demás tienen -1 para salir del ciclo Tab normal.
             */}
            <button
              className="card__cover"
              tabIndex={index === focusedIndex ? 0 : -1}
              aria-label={`Abrir ${comic.title}`}
              onClick={() => onOpen(comic)}
              onFocus={() => setFocusedIndex(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {comic.cover ? (
                <img src={comic.cover} alt={comic.title} loading="lazy" />
              ) : (
                <div className="card__placeholder">{comic.format.toUpperCase()}</div>
              )}
              {progress > 0 && (
                <div
                  className="card__progress"
                  style={{ width: `${progress * 100}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progreso: ${Math.round(progress * 100)}%`}
                />
              )}
              <span className="card__badge" aria-hidden="true">
                {comic.format.toUpperCase()}
              </span>
            </button>
            <div className="card__meta">
              <h3 className="card__title" title={comic.title}>
                {comic.title}
              </h3>
              <div className="card__sub">
                <span>
                  {comic.pageCount > 0 ? `${comic.pageCount} págs.` : comic.format.toUpperCase()}
                </span>
                <button
                  className="card__delete"
                  title="Quitar de la biblioteca"
                  aria-label={`Quitar ${comic.title} de la biblioteca`}
                  onClick={() => onDelete(comic.id)}
                >
                  <Icon name="trash" size={14} />
                  Quitar
                </button>
              </div>
              <select
                className="card__move"
                title="Mover a un pocket"
                aria-label={`Mover ${comic.title} a un pocket`}
                value={comic.pocketId ?? ''}
                onChange={(e) =>
                  onMove(comic.id, e.target.value === '' ? null : Number(e.target.value))
                }
              >
                <option value="">Sin pocket</option>
                {pockets.map((pocket) => (
                  <option key={pocket.id} value={pocket.id}>
                    {pocket.name}
                  </option>
                ))}
              </select>
            </div>
          </article>
        );
      })}
    </div>
  );
}
