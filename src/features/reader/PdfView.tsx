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
  /** Se llama al soltar una selección, con el texto y su ancla serializada. */
  onSelect: (text: string, location: string) => void;
  /** Si se pasa, se invoca una vez con la portada (página 1) para persistirla. */
  onCover?: (cover: Uint8Array) => void;
}

/** Rectángulo de un resaltado, normalizado a fracciones (0..1) del tamaño de página. */
interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ancla guardada en el campo `location` de un resaltado PDF. */
interface PdfAnchor {
  page: number | null;
  rects: NormRect[];
}

function anchorOf(location: string | null): PdfAnchor {
  if (!location) return { page: null, rects: [] };
  try {
    const o = JSON.parse(location) as { page?: number; rects?: NormRect[] };
    return { page: o.page ?? null, rects: o.rects ?? [] };
  } catch {
    return { page: null, rects: [] };
  }
}

/**
 * Render de PDF con pdf.js: cada página se dibuja en un canvas con su capa de texto
 * encima (selección nativa del navegador). Los resaltados se guardan como rects
 * normalizados al tamaño de página y se repintan como overlays posicionados, de modo
 * que sobreviven a cambios de escala. Resaltados antiguos sin rects caen al modo por
 * coincidencia de texto (compatibilidad hacia atrás).
 */
export function PdfView({ data, highlights, onSelect, onCover }: PdfViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCoverRef = useRef(onCover);
  onCoverRef.current = onCover;
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

        applyHighlights(pageEl, n, highlightsRef.current);

        // La página 1 sirve de portada si el llamador la pidió.
        if (n === 1 && onCoverRef.current) {
          canvas.toBlob(
            (blob) => {
              if (blob)
                void blob.arrayBuffer().then((b) => onCoverRef.current?.(new Uint8Array(b)));
            },
            'image/jpeg',
            0.7,
          );
        }
      }
    })();

    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (!text || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const node = range.startContainer;
      const pageEl = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(
        '.pdfpage',
      );
      if (!pageEl) return;
      const page = Number(pageEl.dataset.page);
      const pageRect = pageEl.getBoundingClientRect();
      // Normaliza los rects del rango a fracciones del tamaño de la página.
      const rects: NormRect[] = Array.from(range.getClientRects()).map((r) => ({
        x: (r.left - pageRect.left) / pageRect.width,
        y: (r.top - pageRect.top) / pageRect.height,
        w: r.width / pageRect.width,
        h: r.height / pageRect.height,
      }));
      onSelectRef.current(text, JSON.stringify({ page, rects }));
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
      applyHighlights(pageEl, Number(pageEl.dataset.page), highlights);
    }
  }, [highlights]);

  return <div ref={containerRef} className="docreader__pdf" />;
}

/**
 * Repinta los resaltados de una página: dibuja un overlay posicionado por cada rect
 * normalizado. Para resaltados antiguos (sin rects) marca los spans por coincidencia
 * de texto, conservando el comportamiento previo.
 */
function applyHighlights(pageEl: HTMLElement, page: number, highlights: Highlight[]): void {
  // Limpia overlays y marcas previas antes de redibujar.
  for (const ov of Array.from(pageEl.querySelectorAll('.tomo-pdf-overlay'))) ov.remove();
  for (const s of Array.from(pageEl.querySelectorAll('.tomo-pdf-hl'))) {
    s.classList.remove('tomo-pdf-hl');
  }

  const width = pageEl.clientWidth;
  const height = pageEl.clientHeight;
  const textEl = pageEl.querySelector<HTMLElement>('.textLayer');

  for (const hl of highlights) {
    const { page: p, rects } = anchorOf(hl.location);
    if (p !== page) continue;

    if (rects.length > 0) {
      for (const r of rects) {
        const overlay = document.createElement('div');
        overlay.className = 'tomo-pdf-overlay';
        overlay.style.left = `${r.x * width}px`;
        overlay.style.top = `${r.y * height}px`;
        overlay.style.width = `${r.w * width}px`;
        overlay.style.height = `${r.h * height}px`;
        overlay.style.background = hl.color || '#F5A623';
        pageEl.appendChild(overlay);
      }
    } else if (textEl) {
      markByText(textEl, hl.text);
    }
  }
}

/** Fallback de compatibilidad: marca spans cuyo texto coincide con la frase guardada. */
function markByText(textEl: HTMLElement, text: string): void {
  const phrase = text.trim();
  if (!phrase) return;
  for (const span of Array.from(textEl.querySelectorAll<HTMLElement>('span'))) {
    const content = span.textContent?.trim();
    if (!content) continue;
    if (phrase.includes(content) || content.includes(phrase)) span.classList.add('tomo-pdf-hl');
  }
}
