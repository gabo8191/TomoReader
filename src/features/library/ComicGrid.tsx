import { Icon } from '@/components/Icon';
import type { Comic, Pocket } from '@/types';

interface ComicGridProps {
  comics: Comic[];
  pockets: Pocket[];
  loading: boolean;
  onOpen: (comicId: number) => void;
  onMove: (comicId: number, pocketId: number | null) => void;
  onDelete: (comicId: number) => void;
}

export function ComicGrid({
  comics,
  pockets,
  loading,
  onOpen,
  onMove,
  onDelete,
}: ComicGridProps): JSX.Element {
  if (loading) {
    return <div className="grid__state">Cargando biblioteca…</div>;
  }

  if (comics.length === 0) {
    return (
      <div className="grid__state">
        <p>No hay cómics aquí todavía.</p>
        <p className="grid__hint">Usa «Importar cómics» para añadir archivos CBR o CBZ.</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {comics.map((comic) => {
        const progress = comic.pageCount > 0 ? (comic.lastPage + 1) / comic.pageCount : 0;
        return (
          <article key={comic.id} className="card">
            <button className="card__cover" onClick={() => onOpen(comic.id)}>
              {comic.cover ? (
                <img src={comic.cover} alt={comic.title} loading="lazy" />
              ) : (
                <div className="card__placeholder">{comic.format.toUpperCase()}</div>
              )}
              {progress > 0 && (
                <div className="card__progress" style={{ width: `${progress * 100}%` }} />
              )}
            </button>
            <div className="card__meta">
              <h3 className="card__title" title={comic.title}>
                {comic.title}
              </h3>
              <div className="card__sub">
                <span>{comic.pageCount} págs.</span>
                <button
                  className="card__delete"
                  title="Quitar de la biblioteca"
                  onClick={() => onDelete(comic.id)}
                >
                  <Icon name="trash" size={14} />
                  Quitar
                </button>
              </div>
              <select
                className="card__move"
                title="Mover a un pocket"
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
