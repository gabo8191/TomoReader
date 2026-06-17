import { useCallback, useEffect, useState } from 'react';
import { useDocReader } from './useDocReader';
import { EpubView } from './EpubView';
import { PdfView } from './PdfView';
import { Icon } from '@/components/Icon';
import { LANGUAGES } from '@/lib/languages';
import type { Comic } from '@/types';
import './docreader.css';

interface DocReaderProps {
  comic: Comic;
  onClose: () => void;
}

interface Selection {
  text: string;
  location: string;
}

/** Decide si una selección es una palabra suelta o una frase. */
const kindOf = (text: string): 'word' | 'phrase' =>
  text.trim().split(/\s+/).length === 1 ? 'word' : 'phrase';

/**
 * Lector de documentos PDF/EPUB con funciones tipo Kindle: al seleccionar texto se
 * abre una barra inferior con la traducción al idioma materno y un botón para
 * resaltar y guardar la frase en el vocabulario.
 */
export function DocReader({ comic, onClose }: DocReaderProps): JSX.Element {
  const doc = useDocReader(comic);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSelect = useCallback((text: string, location: string) => {
    setSelection({ text, location });
    setTranslation(null);
    setSaved(false);
  }, []);

  // Traduce automáticamente al seleccionar.
  useEffect(() => {
    if (!selection) return;
    let active = true;
    setTranslating(true);
    void (async () => {
      try {
        const result = await doc.translate(selection.text);
        if (active) setTranslation(result.translation);
      } catch (err) {
        if (active) setTranslation(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setTranslating(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selection, doc]);

  // Cerrar el lector con Escape (si no hay barra de selección abierta).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selection) setSelection(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, onClose]);

  const handleHighlight = useCallback(async () => {
    if (!selection) return;
    await doc.addHighlight({
      kind: kindOf(selection.text),
      text: selection.text,
      translation,
      sourceLang: doc.language ?? 'auto',
      targetLang: doc.nativeLanguage,
      location: selection.location,
    });
    setSaved(true);
  }, [selection, translation, doc]);

  return (
    <div className="docreader">
      <header className="docreader__topbar">
        <button className="iconbtn" onClick={onClose} title="Volver a la biblioteca">
          <Icon name="back" />
        </button>
        <span className="docreader__title" title={comic.title}>
          {comic.title}
        </span>
        <label className="docreader__lang" title="Idioma del libro">
          <Icon name="settings" size={16} />
          <select
            value={doc.language ?? ''}
            onChange={(e) => void doc.setLanguage(e.target.value || null)}
          >
            <option value="">Auto</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="docreader__stage">
        {doc.loading && <div className="docreader__msg">Abriendo documento…</div>}
        {doc.error && <div className="docreader__msg docreader__msg--error">{doc.error}</div>}
        {!doc.loading && !doc.error && doc.data && doc.format === 'epub' && (
          <EpubView data={doc.data} highlights={doc.highlights} onSelect={onSelect} />
        )}
        {!doc.loading && !doc.error && doc.data && doc.format === 'pdf' && (
          <PdfView data={doc.data} highlights={doc.highlights} onSelect={onSelect} />
        )}
      </div>

      {selection && (
        <div className="lookup" onClick={(e) => e.stopPropagation()}>
          <div className="lookup__texts">
            <p className="lookup__source">{selection.text}</p>
            <p className="lookup__target">{translating ? 'Traduciendo…' : (translation ?? '—')}</p>
          </div>
          <div className="lookup__actions">
            <button
              className="btn btn--primary"
              onClick={() => void handleHighlight()}
              disabled={saved}
            >
              <Icon name="brightness" size={16} />
              {saved ? 'Guardada' : 'Resaltar y guardar'}
            </button>
            <button className="btn btn--ghost" onClick={() => setSelection(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
