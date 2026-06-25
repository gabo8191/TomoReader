import { useEffect, useRef } from 'react';
import ePub, { type Rendition } from 'epubjs';
import type { Highlight, ReadingTheme } from '@/types';
import type { EpubHandle, SearchResult, TocItem } from './DocReader';

/**
 * Paleta por tema para inyectar en el contenido del EPUB. epub.js renderiza el libro
 * dentro de un iframe con sus propios estilos, así que el `data-theme` global de la app
 * no llega ahí; hay que aplicarlo vía `rendition.themes`. Forzamos el color del texto con
 * `!important` porque muchos EPUB fijan su propio color y en fondos oscuros quedarían
 * ilegibles.
 */
const THEME_PALETTE: Record<ReadingTheme, { background: string; color: string }> = {
  dark: { background: '#1f2230', color: '#d6dae6' },
  oled: { background: '#000000', color: '#cfd2da' },
  sepia: { background: '#f4ecd8', color: '#5b4636' },
  light: { background: '#ffffff', color: '#1a1a1a' },
};

interface EpubViewProps {
  data: ArrayBuffer;
  highlights: Highlight[];
  /** Se llama al soltar una selección de texto, con el texto y su CFI serializado. */
  onSelect: (text: string, location: string) => void;
  /**
   * CFI de posición inicial (del campo `lastLocation`).
   * Null o undefined → arranca al inicio sin error.
   */
  initialCfi?: string | null;
  /** Se llama cada vez que el libro cambia de posición con el CFI actual. */
  onRelocated?: (cfi: string) => void;
  /** Ref imperativo para controlar el render desde el padre. */
  imperativeRef?: React.MutableRefObject<EpubHandle | null>;
  /** Se llama una vez con el TOC del libro cuando está disponible. */
  onTocReady?: (items: TocItem[]) => void;
  /** Inyecta la función de búsqueda al padre para que la invoque. */
  onSearchReady?: (fn: (query: string) => Promise<SearchResult[]>) => void;
  /** Inyecta la función de navegación por TOC al padre. */
  onGoToTocReady?: (fn: (href: string) => void) => void;
  /** Tema de lectura a aplicar al contenido del libro (fondo y color de texto). */
  theme: ReadingTheme;
  /** Tamaño del texto en porcentaje (100 = tamaño original del libro). */
  fontSize: number;
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

/** Nodo del TOC tal como lo expone epub.js (tipado mínimo para evitar `any`). */
interface EpubTocNode {
  label: string;
  href: string;
  subitems?: EpubTocNode[];
}

/** Resultado de búsqueda dentro de un spine de epub.js. */
interface EpubSearchMatch {
  excerpt: string;
  cfi: string;
}

/** Sección del spine de epub.js (API interna con tipos mínimos necesarios). */
interface EpubSpineSection {
  load: (loader: unknown) => Promise<void>;
  find: (query: string) => EpubSearchMatch[];
  unload: () => void;
}

/** Spine de epub.js con la API mínima que usamos. */
interface EpubSpine {
  each: (cb: (section: EpubSpineSection) => void) => void;
}

/**
 * `Contents` de epub.js: representa el documento de un capítulo dentro del iframe.
 * Tipamos solo lo que usamos para detectar la selección y derivar el CFI.
 */
interface EpubContents {
  document: Document;
  window: Window;
  cfiFromRange: (range: Range) => string;
}

/**
 * Convierte los ítems del TOC de epub.js al formato `TocItem` de la UI.
 * Recursivo para manejar subniveles.
 */
function flattenToc(items: EpubTocNode[], level = 0): TocItem[] {
  const result: TocItem[] = [];
  for (const item of items) {
    result.push({ label: item.label.trim(), href: item.href, level });
    if (Array.isArray(item.subitems) && item.subitems.length > 0) {
      result.push(...flattenToc(item.subitems, level + 1));
    }
  }
  return result;
}

/**
 * Render de EPUB con epub.js. La selección de texto es nativa (ocurre dentro del
 * iframe de epub.js) y se reporta vía el evento `selected`, que da un CFI preciso
 * para resaltar y reposicionar el resaltado al reabrir el libro.
 *
 * Añade soporte de:
 * - Posicionamiento inicial por CFI (`initialCfi`).
 * - Evento `relocated` para guardar el progreso de lectura.
 * - Ref imperativo `imperativeRef` para saltar a un CFI desde el padre.
 * - TOC extraído de `book.navigation.toc`.
 * - Búsqueda por spine con epub.js.
 */
export function EpubView({
  data,
  highlights,
  onSelect,
  initialCfi,
  onRelocated,
  imperativeRef,
  onTocReady,
  onSearchReady,
  onGoToTocReady,
  theme,
  fontSize,
}: EpubViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  // Ref para que el callback siempre sea el último sin re-crear el render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onRelocatedRef = useRef(onRelocated);
  onRelocatedRef.current = onRelocated;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const book = ePub(data);
    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      // Una sola columna por página (en vez de doble página en pantallas anchas).
      spread: 'none',
    });
    renditionRef.current = rendition;

    // Detección de selección por SONDEO. epub.js detecta selección reaccionando al
    // evento `selectionchange` del iframe, pero en WebKitGTK (webview de Linux) ese
    // evento —y los demás eventos del puntero— no se entregan al contexto padre, así que
    // su evento `selected` nunca llega (probado: fallaron `selected`, `mouseup`,
    // `touchend` y `pointerup`). En cambio, leer `getSelection()` del iframe SÍ devuelve
    // la selección (es lo que hace epub.js internamente); lo único roto es el disparador.
    // Por eso sondeamos cada 350 ms el estado de selección de los capítulos visibles.
    // `lastKey` evita reportar dos veces lo mismo y se limpia al deseleccionar para poder
    // volver a seleccionar el mismo texto.
    // ponytail: sondeo a 350 ms; suficiente para selección manual. Si hiciera falta menor
    // latencia, bajar el intervalo o reintroducir eventos cuando WebKitGTK los entregue.
    let lastKey = '';
    const pollSelection = (): void => {
      let contentsList: EpubContents[] = [];
      try {
        contentsList = (rendition.getContents() as unknown as EpubContents[]) ?? [];
      } catch {
        return;
      }
      for (const contents of contentsList) {
        let sel: Selection | null = null;
        try {
          sel = contents.window.getSelection();
        } catch {
          continue; // Capítulo aún no accesible.
        }
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) continue;
        const text = sel.toString().trim();
        if (!text) continue;
        let cfi = '';
        try {
          cfi = contents.cfiFromRange(sel.getRangeAt(0));
        } catch {
          // Sin CFI no podemos anclar el resaltado, pero igual permitimos traducir.
        }
        const key = cfi || text;
        if (key === lastKey) return; // Ya reportada esta selección.
        lastKey = key;
        onSelectRef.current(text, JSON.stringify({ cfi }));
        return;
      }
      // Ninguna selección activa en ningún capítulo: permitir reseleccionar lo mismo.
      lastKey = '';
    };
    const selectionPollId = window.setInterval(pollSelection, 350);

    // Tema inicial del contenido del libro (fondo + color de texto).
    const palette = THEME_PALETTE[theme];
    rendition.themes.register('tomo', {
      body: { background: palette.background, color: palette.color },
      'p, div, span, a, li, h1, h2, h3, h4, h5, h6, blockquote': {
        color: `${palette.color} !important`,
      },
    });
    rendition.themes.select('tomo');
    rendition.themes.fontSize(`${fontSize}%`);

    // Expone el handle imperativo al padre para permitir saltar a un CFI externo.
    if (imperativeRef) {
      imperativeRef.current = {
        display: (cfi: string) => {
          void rendition.display(cfi);
        },
      };
    }

    // Posiciona en el CFI guardado o al inicio.
    if (initialCfi) {
      void rendition.display(initialCfi);
    } else {
      void rendition.display();
    }

    // Guarda el progreso de lectura al cambiar de posición.
    // El evento 'relocated' de epub.js no tiene tipos, usamos un tipo local explícito.
    const handleRelocated = (location: { start?: { cfi?: string } }) => {
      const cfi: string = location?.start?.cfi ?? '';
      if (cfi) onRelocatedRef.current?.(cfi);
    };
    rendition.on('relocated', handleRelocated);

    // Navegación con flechas también cuando el foco está dentro del iframe.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') void rendition.next();
      if (e.key === 'ArrowLeft') void rendition.prev();
    };
    rendition.on('keyup', onKey);
    window.addEventListener('keyup', onKey);

    // Extrae el TOC cuando el libro esté listo.
    // book.navigation no tiene tipos completos en @types/epubjs; casteamos con tipo local.
    void book.ready.then(() => {
      const nav = book.navigation as { toc?: EpubTocNode[] };
      const tocItems = Array.isArray(nav.toc) ? flattenToc(nav.toc) : [];
      onTocReady?.(tocItems);
    });

    // Inyecta la función de navegación TOC en el padre.
    onGoToTocReady?.((href: string) => {
      void rendition.display(href);
    });

    // Inyecta la función de búsqueda en el padre (búsqueda por spine bajo demanda).
    // book.spine no tiene tipos completos; lo casteamos con la interfaz local EpubSpine.
    onSearchReady?.(async (query: string): Promise<SearchResult[]> => {
      const results: SearchResult[] = [];
      const spine = book.spine as unknown as EpubSpine | undefined;
      if (!spine?.each) return results;
      const sections: EpubSpineSection[] = [];
      spine.each((s) => sections.push(s));
      for (const s of sections) {
        try {
          await s.load(book.load.bind(book));
          const found = s.find(query);
          for (const match of found) {
            results.push({
              excerpt: match.excerpt,
              cfi: match.cfi,
            });
          }
          s.unload();
        } catch {
          // Ignora secciones que no se puedan cargar.
        }
      }
      return results;
    });

    return () => {
      window.clearInterval(selectionPollId);
      rendition.off('relocated', handleRelocated);
      window.removeEventListener('keyup', onKey);
      book.destroy();
      renditionRef.current = null;
      if (imperativeRef) imperativeRef.current = null;
    };
    // Solo se ejecuta cuando cambian los bytes del documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Reaplica tema y tamaño de texto al contenido del libro cuando cambian.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const palette = THEME_PALETTE[theme];
    rendition.themes.register('tomo', {
      body: { background: palette.background, color: palette.color },
      'p, div, span, a, li, h1, h2, h3, h4, h5, h6, blockquote': {
        color: `${palette.color} !important`,
      },
    });
    rendition.themes.select('tomo');
    rendition.themes.fontSize(`${fontSize}%`);
  }, [theme, fontSize]);

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
