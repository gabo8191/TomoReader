import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/Icon';
import { languageName } from '@/lib/languages';
import type { Comic, Highlight } from '@/types';
import './vocabulary.css';

interface VocabularyViewProps {
  onClose: () => void;
}

/**
 * Listado del vocabulario guardado (palabras y frases resaltadas en PDF/EPUB), con
 * su traducción e idiomas. Permite filtrar por libro y eliminar entradas.
 */
export function VocabularyView({ onClose }: VocabularyViewProps): JSX.Element {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [comics, setComics] = useState<Comic[]>([]);
  const [bookFilter, setBookFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [hs, cs] = await Promise.all([api.listHighlights(null), api.listComics(null)]);
      setHighlights(hs);
      setComics(cs);
      setLoading(false);
    })();
  }, []);

  const titleById = useMemo(() => new Map(comics.map((c) => [c.id, c.title])), [comics]);

  const visible = useMemo(
    () => (bookFilter === null ? highlights : highlights.filter((h) => h.comicId === bookFilter)),
    [highlights, bookFilter],
  );

  // Solo libros que tienen al menos una entrada guardada.
  const booksWithEntries = useMemo(() => {
    const ids = new Set(highlights.map((h) => h.comicId));
    return comics.filter((c) => ids.has(c.id));
  }, [highlights, comics]);

  const remove = async (id: number) => {
    await api.deleteHighlight(id);
    setHighlights((hs) => hs.filter((h) => h.id !== id));
  };

  return (
    <div className="vocab-overlay" onClick={onClose}>
      <div className="vocab" onClick={(e) => e.stopPropagation()}>
        <header className="vocab__header">
          <h2>Vocabulario y frases</h2>
          <button className="iconbtn" onClick={onClose} title="Cerrar">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="vocab__filter">
          <select
            value={bookFilter ?? ''}
            onChange={(e) => setBookFilter(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Todos los libros</option>
            {booksWithEntries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <span className="vocab__count">{visible.length} entrada(s)</span>
        </div>

        <div className="vocab__list">
          {loading && <p className="vocab__empty">Cargando…</p>}
          {!loading && visible.length === 0 && (
            <p className="vocab__empty">
              Aún no has guardado frases. Selecciona texto en un PDF o EPUB y pulsa «Resaltar y
              guardar».
            </p>
          )}
          {visible.map((h) => (
            <article key={h.id} className="vocab__item">
              <div className="vocab__texts">
                <p className="vocab__source">{h.text}</p>
                {h.translation && <p className="vocab__target">{h.translation}</p>}
                <p className="vocab__meta">
                  {titleById.get(h.comicId) ?? 'Libro'} · {languageName(h.sourceLang)} →{' '}
                  {languageName(h.targetLang)}
                </p>
              </div>
              <button className="iconbtn" onClick={() => void remove(h.id)} title="Eliminar">
                <Icon name="trash" size={16} />
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
