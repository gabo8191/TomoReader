import { useEffect, useRef } from 'react';
import ePub, { type Rendition } from 'epubjs';
import type { Highlight } from '@/types';

interface EpubViewProps {
  data: ArrayBuffer;
  highlights: Highlight[];
  /** Se llama al soltar una selección de texto, con el texto y su CFI serializado. */
  onSelect: (text: string, location: string) => void;
}

/** Extrae el CFI guardado en el campo `location` de un resaltado EPUB. */
function cfiOf(location: string | null): string | null {
  if (!location) return null;
  try {
    return (JSON.parse(location) as { cfi?: string }).cfi ?? null;
  } catch {
    return null;
  }
}

/**
 * Render de EPUB con epub.js. La selección de texto es nativa (ocurre dentro del
 * iframe de epub.js) y se reporta vía el evento `selected`, que da un CFI preciso
 * para resaltar y reposicionar el resaltado al reabrir el libro.
 */
export function EpubView({ data, highlights, onSelect }: EpubViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  // Ref para que el callback siempre sea el último sin re-crear el render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const book = ePub(data);
    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'auto',
    });
    renditionRef.current = rendition;
    void rendition.display();

    const handleSelected = (cfiRange: string) => {
      const text = rendition.getRange(cfiRange)?.toString().trim() ?? '';
      if (text) onSelectRef.current(text, JSON.stringify({ cfi: cfiRange }));
    };
    rendition.on('selected', handleSelected);

    // Navegación con flechas también cuando el foco está dentro del iframe.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') void rendition.next();
      if (e.key === 'ArrowLeft') void rendition.prev();
    };
    rendition.on('keyup', onKey);
    window.addEventListener('keyup', onKey);

    return () => {
      rendition.off('selected', handleSelected);
      window.removeEventListener('keyup', onKey);
      book.destroy();
      renditionRef.current = null;
    };
  }, [data]);

  // Repinta los resaltados guardados cuando cambian.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    for (const h of highlights) {
      const cfi = cfiOf(h.location);
      if (!cfi) continue;
      try {
        rendition.annotations.highlight(cfi, {}, () => {}, 'tomo-hl', { fill: h.color });
      } catch {
        // El capítulo puede no estar renderizado aún; se reintentará al cambiar.
      }
    }
  }, [highlights]);

  const rendition = () => renditionRef.current;

  return (
    <div className="docreader__surface">
      <button
        className="docreader__nav docreader__nav--left"
        aria-label="Página anterior"
        onClick={() => void rendition()?.prev()}
      />
      <div ref={containerRef} className="docreader__epub" />
      <button
        className="docreader__nav docreader__nav--right"
        aria-label="Página siguiente"
        onClick={() => void rendition()?.next()}
      />
    </div>
  );
}
