import { useEffect, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { Highlight } from '@/types';
import type { PdfHandle, SearchResult, TocItem } from './DocReader';
import { nearestPageInViewport } from './pdfUtils';

// pdf.js necesita un worker dedicado; Vite lo empaqueta con el sufijo `?worker`.
pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();

interface PdfViewProps {
  data: ArrayBuffer;
  highlights: Highlight[];
  /** Se llama al soltar una selección, con el texto y su ancla serializada. */
  onSelect: (text: string, location: string) => void;
  /** Si se pasa, se invoca una vez con la portada (página 1) para persistirla. */
  onCover?: (cover: Uint8Array) => void;
  /**
   * Página inicial (base 1, misma escala que `data-page` del DOM).
   * Undefined o 0 → arranca en la primera página sin error.
   */
  initialPage?: number;
  /** Se llama al cambiar la página visible con el número de página (base 1). */
  onPageChange?: (page: number) => void;
  /** Se llama una vez con el número total de páginas cuando el PDF está cargado. */
  onNumPages?: (numPages: number) => void;
  /** Ref imperativo para controlar el scroll desde el padre. */
  imperativeRef?: React.MutableRefObject<PdfHandle | null>;
  /** Se llama una vez con el TOC (outline) del PDF cuando está disponible. */
  onTocReady?: (items: TocItem[]) => void;
  /** Inyecta la función de búsqueda al padre para que la invoque. */
  onSearchReady?: (fn: (query: string) => Promise<SearchResult[]>) => void;
  /** Inyecta la función de navegación por TOC al padre. */
  onGoToTocReady?: (fn: (href: string) => void) => void;
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
 * Render de PDF con pdf.js virtualizado por viewport.
 *
 * Estrategia de virtualización (sin librería):
 * - Se crean todos los contenedores `.pdfpage` con su alto/ancho reservado desde el inicio
 *   (evita CLS y mantiene el scroll correcto).
 * - Un `IntersectionObserver` con `rootMargin` de 1× el alto del viewport renderiza el
 *   canvas y el textLayer cuando la página entra en la zona visible + margen.
 * - Al salir del margen, el canvas se elimina del DOM (libera memoria GPU); el
 *   contenedor vacío conserva el espacio reservado.
 * - Los resaltados se reaplican al re-renderizar cada página.
 * - La página visible más cercana al tope se reporta via `onPageChange` (debounce 600 ms).
 */
export function PdfView({
  data,
  highlights,
  onSelect,
  onCover,
  initialPage,
  onPageChange,
  onNumPages,
  imperativeRef,
  onTocReady,
  onSearchReady,
  onGoToTocReady,
}: PdfViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCoverRef = useRef(onCover);
  onCoverRef.current = onCover;
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;

  // Guarda el doc pdf.js para usarlo en la búsqueda (desde callbacks inyectados).
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  // Offsets verticales de cada página (top en px) para calcular la página visible.
  const pageOffsetsRef = useRef<number[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    void (async () => {
      // slice(0) evita que pdf.js consuma (detach) el ArrayBuffer compartido.
      const pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
      if (cancelled) return;
      pdfDocRef.current = pdf;
      onNumPages?.(pdf.numPages);

      // ── Fase 1: crear todos los contenedores con tamaño reservado ────────────
      // Se obtiene el viewport de la primera página para calcular el scale óptimo.
      const firstPage = await pdf.getPage(1);
      const refViewport = firstPage.getViewport({ scale: 1.5 });
      const pageWidth = refViewport.width;
      const pageHeight = refViewport.height;

      const pageEls: HTMLElement[] = [];
      const offsets: number[] = [];
      let cumulativeTop = 16; // padding inicial de docreader__pdf

      for (let n = 1; n <= pdf.numPages; n++) {
        const pageEl = document.createElement('div');
        pageEl.className = 'pdfpage pdfpage--placeholder';
        pageEl.dataset.page = String(n);
        pageEl.style.width = `${pageWidth}px`;
        pageEl.style.height = `${pageHeight}px`;
        container.appendChild(pageEl);
        offsets.push(cumulativeTop);
        // 16 px de gap entre páginas (coincide con el gap del contenedor).
        cumulativeTop += pageHeight + 16;
        pageEls.push(pageEl);
      }
      pageOffsetsRef.current = offsets;

      if (cancelled) return;

      // ── Fase 2: debounce para reportar la página visible ──────────────────
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const reportPage = () => {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const scrollTop = container.scrollTop;
          const page = nearestPageInViewport(scrollTop, pageOffsetsRef.current);
          onPageChangeRef.current?.(page);
        }, 600);
      };
      container.addEventListener('scroll', reportPage, { passive: true });

      // ── Fase 3: IntersectionObserver para virtualizar el render ─────────
      const renderPage = async (pageEl: HTMLElement) => {
        if (pageEl.dataset.rendered === '1') return;
        pageEl.dataset.rendered = '1';
        const n = Number(pageEl.dataset.page);
        const page = await pdf.getPage(n);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        pageEl.classList.remove('pdfpage--placeholder');
        pageEl.appendChild(canvas);

        const textEl = document.createElement('div');
        textEl.className = 'textLayer';
        pageEl.appendChild(textEl);

        if (ctx) await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (cancelled) return;

        const textLayer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textEl,
          viewport,
        });
        await textLayer.render();
        if (cancelled) return;

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
      };

      const discardPage = (pageEl: HTMLElement) => {
        // Elimina el canvas y el textLayer para liberar memoria; conserva el espacio reservado.
        const canvas = pageEl.querySelector('canvas');
        const textEl = pageEl.querySelector('.textLayer');
        canvas?.remove();
        textEl?.remove();
        delete pageEl.dataset.rendered;
        pageEl.classList.add('pdfpage--placeholder');
      };

      // rootMargin de 1× el alto del viewport: pre-renderiza páginas próximas.
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const pageEl = entry.target as HTMLElement;
            if (entry.isIntersecting) {
              void renderPage(pageEl);
            } else {
              discardPage(pageEl);
            }
          }
        },
        { root: container, rootMargin: '100% 0px' },
      );

      for (const pageEl of pageEls) {
        if (cancelled) break;
        observer.observe(pageEl);
      }

      // ── Fase 4: scroll a la página inicial ───────────────────────────────
      if (initialPage && initialPage > 0 && initialPage <= pdf.numPages) {
        const targetOffset = pageOffsetsRef.current[initialPage - 1];
        if (targetOffset !== undefined) {
          container.scrollTop = targetOffset;
        }
      }

      // ── Fase 5: exponer el handle imperativo ──────────────────────────────
      if (imperativeRef) {
        imperativeRef.current = {
          scrollToPage: (page: number) => {
            const offset = pageOffsetsRef.current[page - 1];
            if (offset !== undefined) container.scrollTop = offset;
          },
        };
      }

      // ── Fase 6: extraer outline (TOC) del PDF ────────────────────────────
      // El tipo de retorno de getOutline es un array de objetos anónimos; lo tipamos localmente.
      type RawOutlineItem = {
        title: string;
        dest: string | unknown[] | null;
        items: RawOutlineItem[];
      };

      void pdf.getOutline().then((outline) => {
        if (!outline) {
          onTocReady?.([]);
          return;
        }
        // Aplana el outline recursivamente a TocItem[].
        const flatten = (items: RawOutlineItem[], level = 0): TocItem[] => {
          const result: TocItem[] = [];
          for (const item of items) {
            // El dest del outline es un destino interno: se serializa como JSON para usarlo en goToToc.
            result.push({
              label: item.title,
              href: JSON.stringify(item.dest),
              level,
            });
            if (item.items && item.items.length > 0) {
              result.push(...flatten(item.items, level + 1));
            }
          }
          return result;
        };
        onTocReady?.(flatten(outline));
      });

      // ── Fase 7: inyectar función de navegación por TOC ────────────────────
      onGoToTocReady?.((href: string) => {
        void (async () => {
          try {
            const parsed = JSON.parse(href) as unknown[] | string | null;
            if (parsed == null) return;
            // El destino puede ser explícito (array) o con NOMBRE (string). Los PDFs reales
            // suelen usar nombres: hay que resolverlos con getDestination antes de obtener la
            // página, o el índice nunca navega (era el bug).
            const dest = typeof parsed === 'string' ? await pdf.getDestination(parsed) : parsed;
            if (!Array.isArray(dest) || dest.length === 0) return;
            // getPageIndex acepta un RefProxy opaco de pdf.js; el primer elemento del array
            // de destino explícito ES ese RefProxy y no existe un tipo exportado para él.
            type RefProxy = Parameters<typeof pdf.getPageIndex>[0];
            const pageIdx: number = await pdf.getPageIndex(dest[0] as RefProxy);
            const page = pageIdx + 1;
            const offset = pageOffsetsRef.current[pageIdx];
            if (offset !== undefined) container.scrollTop = offset;
            onPageChangeRef.current?.(page);
          } catch {
            // Ignorar destinos no resolvibles.
          }
        })();
      });

      // ── Fase 8: inyectar función de búsqueda al padre ────────────────────
      onSearchReady?.(async (query: string): Promise<SearchResult[]> => {
        const results: SearchResult[] = [];
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return results;

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
          const idx = pageText.toLowerCase().indexOf(normalizedQuery);
          if (idx !== -1) {
            // Extrae un extracto de ±40 caracteres alrededor de la coincidencia.
            const start = Math.max(0, idx - 40);
            const end = Math.min(pageText.length, idx + normalizedQuery.length + 40);
            const excerpt = pageText.slice(start, end).trim();
            results.push({ excerpt, page: n });
          }
        }
        return results;
      });

      return () => {
        container.removeEventListener('scroll', reportPage);
        observer.disconnect();
        if (debounceTimer !== null) clearTimeout(debounceTimer);
      };
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
      pdfDocRef.current = null;
      if (imperativeRef) imperativeRef.current = null;
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

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
