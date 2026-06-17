import { useEffect, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { Highlight } from '@/types';

// pdf.js necesita un worker dedicado; Vite lo empaqueta con el sufijo `?worker`.
pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();

interface PdfViewProps {
  data: ArrayBuffer;
  highlights: Highlight[];
  /** Se llama al soltar una selección, con el texto y su página serializada. */
  onSelect: (text: string, location: string) => void;
}

/** Página guardada en el campo `location` de un resaltado PDF. */
function pageOf(location: string | null): number | null {
  if (!location) return null;
  try {
    return (JSON.parse(location) as { page?: number }).page ?? null;
  } catch {
    return null;
  }
}

/**
 * Render de PDF con pdf.js: cada página se dibuja en un canvas con su capa de
 * texto encima, lo que permite selección nativa del navegador. Los resaltados se
 * re-aplican por coincidencia de texto en la página (aproximado pero suficiente).
 */
export function PdfView({ data, highlights, onSelect }: PdfViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    void (async () => {
      // slice(0) evita que pdf.js consuma (detach) el ArrayBuffer compartido.
      const pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
      for (let n = 1; n <= pdf.numPages; n++) {
        if (cancelled) break;
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 1.5 });

        const pageEl = document.createElement('div');
        pageEl.className = 'pdfpage';
        pageEl.dataset.page = String(n);
        pageEl.style.width = `${viewport.width}px`;
        pageEl.style.height = `${viewport.height}px`;

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        pageEl.appendChild(canvas);

        const textEl = document.createElement('div');
        textEl.className = 'textLayer';
        pageEl.appendChild(textEl);
        container.appendChild(pageEl);

        if (ctx) await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const textLayer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textEl,
          viewport,
        });
        await textLayer.render();

        applyHighlights(textEl, n, highlightsRef.current);
      }
    })();

    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!text || selection?.rangeCount === 0) return;
      const node = selection?.getRangeAt(0).startContainer;
      const pageEl = (node instanceof Element ? node : node?.parentElement)?.closest('.pdfpage');
      const page = pageEl ? Number((pageEl as HTMLElement).dataset.page) : null;
      onSelectRef.current(text, JSON.stringify({ page }));
    };
    container.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelled = true;
      container.removeEventListener('mouseup', handleMouseUp);
      container.replaceChildren();
    };
  }, [data]);

  // Re-aplica resaltados cuando cambian (sobre las páginas ya renderizadas).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const pageEl of Array.from(container.querySelectorAll<HTMLElement>('.pdfpage'))) {
      const textEl = pageEl.querySelector<HTMLElement>('.textLayer');
      const page = Number(pageEl.dataset.page);
      if (textEl) applyHighlights(textEl, page, highlights);
    }
  }, [highlights]);

  return <div ref={containerRef} className="docreader__pdf" />;
}

/**
 * Marca como resaltados los spans de texto de una página que forman parte de una
 * frase guardada. Es una coincidencia por contenido (no por coordenadas exactas).
 */
function applyHighlights(textEl: HTMLElement, page: number, highlights: Highlight[]): void {
  const phrases = highlights
    .filter((h) => pageOf(h.location) === page)
    .map((h) => h.text.trim())
    .filter(Boolean);
  if (phrases.length === 0) return;

  for (const span of Array.from(textEl.querySelectorAll<HTMLElement>('span'))) {
    const content = span.textContent?.trim();
    if (!content) continue;
    const matches = phrases.some((p) => p.includes(content) || content.includes(p));
    span.classList.toggle('tomo-pdf-hl', matches);
  }
}
