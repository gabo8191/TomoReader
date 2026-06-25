import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useDocReader, TranslationError } from './useDocReader';
import { Icon } from '@/components/Icon';
import { toast } from '@/lib/toast-store';
import { LANGUAGES } from '@/lib/languages';
import { useSettings } from '@/lib/settings-store';
import type { Comic, ReadingTheme } from '@/types';
import './docreader.css';

/** Orden de ciclo de temas al pulsar el botón de tema en el lector. */
const THEME_ORDER: ReadingTheme[] = ['sepia', 'dark', 'oled', 'light'];

// Carga diferida: pdf.js y epub.js son pesados; así caen en chunks aparte y solo se
// descargan al abrir un documento (code-splitting, evita el warning de tamaño de Vite).
const EpubView = lazy(() => import('./EpubView').then((m) => ({ default: m.EpubView })));
const PdfView = lazy(() => import('./PdfView').then((m) => ({ default: m.PdfView })));

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

/** Comprueba si un error lanzado por `translate` es un `TranslationError` tipado. */
function isTranslationError(e: unknown): e is TranslationError {
  return e instanceof TranslationError;
}

/** Ref de scroll imperativo expuesto por PdfView para saltar a una página. */
export interface PdfHandle {
  scrollToPage: (page: number) => void;
}

/** Ref imperativo expuesto por EpubView para saltar a un CFI. */
export interface EpubHandle {
  display: (cfi: string) => void;
}

/**
 * Lector de documentos PDF/EPUB con funciones tipo Kindle: al seleccionar texto se
 * abre una barra inferior con la traducción al idioma materno y un botón para
 * resaltar y guardar la frase en el vocabulario.
 *
 * Mejoras sobre v0.2:
 * - Progreso de lectura guardado (debounce 600 ms) y restaurado al abrir.
 * - Error de traducción tipado con botón «Reintentar» cuando el fallo es de red.
 * - Panel de resaltados del libro actual (editar nota, borrar, ir a posición).
 * - Panel de TOC y búsqueda en el documento.
 */
export function DocReader({ comic, onClose }: DocReaderProps): JSX.Element {
  const doc = useDocReader(comic);

  // Preferencias de confort (brillo/calidez/tema). Antes solo las usaba el lector de
  // cómics; aquí también se aplican para que lo configurado en ajustes surta efecto en
  // PDF/EPUB. El filtro va sobre el contenedor del documento (afecta tanto al canvas del
  // PDF como al iframe del EPUB); el tema del texto del EPUB lo aplica EpubView.
  const { brightness, warmth, theme, fontSize, setBrightness, setWarmth, setTheme, setFontSize } =
    useSettings();
  const [showComfort, setShowComfort] = useState(false);

  // Navegación de páginas en PDF (el EPUB ya pagina con sus flechas laterales).
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const docFilter = `brightness(${brightness}) sepia(${warmth * 0.35}) saturate(${1 - warmth * 0.1})`;
  const cycleTheme = (): void =>
    setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length] as ReadingTheme);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translationErr, setTranslationErr] = useState<TranslationError | null>(null);
  const [saved, setSaved] = useState(false);

  // Refs imperativos para controlar el scroll/display desde fuera del subcomponente.
  const pdfRef = useRef<PdfHandle | null>(null);
  const epubRef = useRef<EpubHandle | null>(null);

  // Panel lateral de resaltados.
  const [showHighlights, setShowHighlights] = useState(false);
  // Resaltado en edición de nota (id => texto de nota temporal).
  const [editingNote, setEditingNote] = useState<{ id: number; note: string } | null>(null);

  // Panel lateral de TOC / búsqueda.
  const [showToc, setShowToc] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Función de búsqueda inyectada por el subcomponente activo.
  const searchFnRef = useRef<((query: string) => Promise<SearchResult[]>) | null>(null);
  // Función de navegación TOC inyectada por el subcomponente activo.
  const goToTocRef = useRef<((href: string) => void) | null>(null);

  const onSelect = useCallback((text: string, location: string) => {
    setSelection({ text, location });
    setTranslation(null);
    setTranslationErr(null);
    setSaved(false);
  }, []);

  // `doc.translate` es estable (memoizado en useDocReader). Lo extraemos para que las
  // dependencias de los callbacks no sean el objeto `doc` completo, que se recrea en cada
  // render: si `runTranslation` dependiera de `doc`, el efecto de traducción se relanzaría
  // en cada render y se quedaría en bucle infinito mostrando «Traduciendo…».
  const translateText = doc.translate;

  /** Ejecuta la traducción y actualiza el estado tipado de error. */
  const runTranslation = useCallback(
    async (text: string) => {
      setTranslating(true);
      setTranslationErr(null);
      try {
        const result = await translateText(text);
        setTranslation(result.translation);
      } catch (err) {
        if (isTranslationError(err)) {
          setTranslationErr(err);
        } else {
          setTranslationErr(new TranslationError(String(err), true));
        }
        setTranslation(null);
      } finally {
        setTranslating(false);
      }
    },
    [translateText],
  );

  // Traduce automáticamente al seleccionar.
  useEffect(() => {
    if (!selection) return;
    void runTranslation(selection.text);
  }, [selection, runTranslation]);

  // Cerrar el lector con Escape (si no hay barra de selección abierta).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selection) setSelection(null);
      else if (showHighlights) setShowHighlights(false);
      else if (showToc) setShowToc(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, showHighlights, showToc, onClose]);

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
    toast.success('Resaltado guardado en el vocabulario.');
  }, [selection, translation, doc]);

  /** Navega al lugar del resaltado en el documento activo. */
  const goToHighlight = useCallback(
    (location: string | null) => {
      if (!location) return;
      if (doc.format === 'epub') {
        try {
          const parsed = JSON.parse(location) as { cfi?: string };
          if (parsed.cfi) epubRef.current?.display(parsed.cfi);
        } catch {
          // Ignorar si el CFI no es parseable.
        }
      } else if (doc.format === 'pdf') {
        try {
          const parsed = JSON.parse(location) as { page?: number };
          if (typeof parsed.page === 'number') pdfRef.current?.scrollToPage(parsed.page);
        } catch {
          // Ignorar si el ancla no es parseable.
        }
      }
    },
    [doc.format],
  );

  /** Guarda la nota editada de un resaltado. */
  const commitNote = useCallback(async () => {
    if (!editingNote) return;
    await doc.updateNote(editingNote.id, editingNote.note || null);
    setEditingNote(null);
    toast.success('Nota actualizada.');
  }, [editingNote, doc]);

  /** Lanza la búsqueda usando la función inyectada por el subcomponente. */
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !searchFnRef.current) return;
    setSearching(true);
    try {
      const results = await searchFnRef.current(searchQuery);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  return (
    <div className="docreader">
      <header className="docreader__topbar">
        <button className="iconbtn" onClick={onClose} title="Volver a la biblioteca">
          <Icon name="back" />
        </button>
        <span className="docreader__title" title={comic.title}>
          {comic.title}
        </span>

        {/* Botón de TOC / búsqueda */}
        <button
          className={`iconbtn${showToc ? ' iconbtn--active' : ''}`}
          title="Índice y búsqueda"
          onClick={() => {
            setShowToc((v) => !v);
            setShowHighlights(false);
          }}
          aria-pressed={showToc}
        >
          <Icon name="book" size={18} />
        </button>

        {/* Botón de panel de resaltados */}
        <button
          className={`iconbtn${showHighlights ? ' iconbtn--active' : ''}`}
          title="Resaltados del libro"
          onClick={() => {
            setShowHighlights((v) => !v);
            setShowToc(false);
          }}
          aria-pressed={showHighlights}
        >
          <Icon name="bookmark" size={18} />
        </button>

        {/* Botón de brillo y calidez */}
        <button
          className={`iconbtn${showComfort ? ' iconbtn--active' : ''}`}
          title="Brillo y calidez"
          onClick={() => setShowComfort((v) => !v)}
          aria-pressed={showComfort}
        >
          <Icon name="brightness" size={18} />
        </button>

        {/* Botón de tema */}
        <button className="iconbtn" title={`Tema: ${theme}`} onClick={cycleTheme}>
          <Icon name="theme" size={18} />
        </button>

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

      {/* Panel rápido de brillo y calidez, dentro del propio lector. */}
      {showComfort && (
        <div className="comfort" onClick={(e) => e.stopPropagation()}>
          <label className="comfort__row">
            <span>
              <Icon name="brightness" size={16} /> Brillo
            </span>
            <span className="comfort__val">{Math.round(brightness * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.02}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            aria-label="Brillo"
          />
          <label className="comfort__row">
            <span>
              <Icon name="warmth" size={16} /> Calidez
            </span>
            <span className="comfort__val">{Math.round(warmth * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={warmth}
            onChange={(e) => setWarmth(Number(e.target.value))}
            aria-label="Calidez"
          />

          {/* Tamaño de texto: solo aplica a EPUB (el PDF es de maquetación fija). */}
          {doc.format === 'epub' && (
            <>
              <label className="comfort__row">
                <span>
                  <Icon name="theme" size={16} /> Tamaño de texto
                </span>
                <span className="comfort__val">{fontSize}%</span>
              </label>
              <input
                type="range"
                min={70}
                max={160}
                step={5}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                aria-label="Tamaño de texto"
              />
            </>
          )}
        </div>
      )}

      <div className="docreader__body">
        {/* Panel lateral izquierdo: TOC + búsqueda */}
        {showToc && (
          <aside className="docreader__panel" aria-label="Índice y búsqueda">
            <div className="panel__header">
              <span className="panel__title">Índice</span>
              <button
                className="iconbtn"
                aria-label="Cerrar panel"
                onClick={() => setShowToc(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Buscador interno */}
            <div className="panel__search">
              <input
                className="panel__input"
                type="text"
                placeholder="Buscar en el documento…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchResults([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSearch();
                }}
                aria-label="Texto a buscar"
              />
              <button
                className="btn btn--primary panel__search-btn"
                onClick={() => void handleSearch()}
                disabled={!searchQuery.trim() || searching}
              >
                {searching ? '…' : 'Buscar'}
              </button>
            </div>

            {/* Resultados de búsqueda */}
            {searchResults.length > 0 && (
              <div className="panel__results">
                <p className="panel__label">{searchResults.length} resultado(s)</p>
                <ul className="panel__list">
                  {searchResults.map((r, i) => (
                    <li key={i}>
                      <button
                        className="panel__item"
                        onClick={() => {
                          if (doc.format === 'epub' && r.cfi) {
                            epubRef.current?.display(r.cfi);
                          } else if (doc.format === 'pdf' && r.page !== undefined) {
                            pdfRef.current?.scrollToPage(r.page);
                          }
                        }}
                      >
                        <span className="panel__item-label">
                          {r.page !== undefined ? `Pág. ${r.page}` : ''}
                        </span>
                        <span className="panel__item-excerpt">{r.excerpt}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="panel__empty">Sin resultados para «{searchQuery}».</p>
            )}

            {/* Lista de TOC */}
            {tocItems.length > 0 && (
              <>
                <p className="panel__label">Índice</p>
                <ul className="panel__list">
                  {tocItems.map((item, i) => (
                    <li key={i}>
                      <button
                        className="panel__item"
                        style={{ paddingLeft: `${8 + (item.level ?? 0) * 12}px` }}
                        onClick={() => goToTocRef.current?.(item.href)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {tocItems.length === 0 && !searchQuery && (
              <p className="panel__empty">Este documento no tiene índice.</p>
            )}
          </aside>
        )}

        {/* Panel lateral derecho: resaltados */}
        {showHighlights && (
          <aside className="docreader__panel docreader__panel--right" aria-label="Resaltados">
            <div className="panel__header">
              <span className="panel__title">Resaltados ({doc.highlights.length})</span>
              <button
                className="iconbtn"
                aria-label="Cerrar panel"
                onClick={() => setShowHighlights(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {doc.highlights.length === 0 && (
              <p className="panel__empty">Aún no hay resaltados en este libro.</p>
            )}

            <ul className="panel__list">
              {doc.highlights.map((h) => (
                <li key={h.id} className="hl-item">
                  <div className="hl-item__color" style={{ background: h.color }} />
                  <div className="hl-item__body">
                    <p className="hl-item__text">{h.text}</p>
                    {h.translation && <p className="hl-item__translation">{h.translation}</p>}

                    {/* Edición inline de nota */}
                    {editingNote?.id === h.id ? (
                      <div className="hl-item__note-edit">
                        <textarea
                          className="hl-item__note-input"
                          value={editingNote.note}
                          onChange={(e) => setEditingNote({ id: h.id, note: e.target.value })}
                          rows={3}
                          placeholder="Añade una nota…"
                          aria-label="Nota del resaltado"
                        />
                        <div className="hl-item__note-actions">
                          <button className="btn btn--primary" onClick={() => void commitNote()}>
                            Guardar
                          </button>
                          <button className="btn btn--ghost" onClick={() => setEditingNote(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {h.note && <p className="hl-item__note">{h.note}</p>}
                        <div className="hl-item__actions">
                          <button
                            className="btn btn--ghost hl-item__btn"
                            onClick={() => goToHighlight(h.location)}
                            title="Ir a la posición del resaltado"
                          >
                            Ir a
                          </button>
                          <button
                            className="btn btn--ghost hl-item__btn"
                            onClick={() => setEditingNote({ id: h.id, note: h.note ?? '' })}
                            title="Editar nota"
                          >
                            <Icon name="settings" size={14} />
                          </button>
                          <button
                            className="btn btn--ghost hl-item__btn hl-item__btn--delete"
                            onClick={() => void doc.removeHighlight(h.id)}
                            title="Borrar resaltado"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <div className="docreader__stage" style={{ filter: docFilter }}>
          {doc.loading && <div className="docreader__msg">Abriendo documento…</div>}
          {doc.error && <div className="docreader__msg docreader__msg--error">{doc.error}</div>}
          {!doc.loading && !doc.error && doc.data && (
            <Suspense fallback={<div className="docreader__msg">Cargando…</div>}>
              {doc.format === 'epub' && (
                <EpubView
                  data={doc.data}
                  highlights={doc.highlights}
                  onSelect={onSelect}
                  initialCfi={comic.lastLocation}
                  onRelocated={(cfi) => void doc.saveProgress(null, cfi)}
                  imperativeRef={epubRef}
                  onTocReady={setTocItems}
                  onSearchReady={(fn) => {
                    searchFnRef.current = fn;
                  }}
                  onGoToTocReady={(fn) => {
                    goToTocRef.current = fn;
                  }}
                  theme={theme}
                  fontSize={fontSize}
                />
              )}
              {doc.format === 'pdf' && (
                <PdfView
                  data={doc.data}
                  highlights={doc.highlights}
                  onSelect={onSelect}
                  onCover={comic.cover ? undefined : (cover) => void doc.saveCover(cover)}
                  initialPage={comic.lastLocation !== null ? Number(comic.lastLocation) : undefined}
                  onPageChange={(page) => {
                    setPdfPage(page);
                    void doc.saveProgress(page, null);
                  }}
                  onNumPages={setPdfNumPages}
                  imperativeRef={pdfRef}
                  onTocReady={setTocItems}
                  onSearchReady={(fn) => {
                    searchFnRef.current = fn;
                  }}
                  onGoToTocReady={(fn) => {
                    goToTocRef.current = fn;
                  }}
                />
              )}
            </Suspense>
          )}
        </div>
      </div>

      {/* Navegación de páginas en PDF: contador + anterior/siguiente. Se oculta cuando hay
          una selección abierta para no solaparse con la barra de traducción. */}
      {doc.format === 'pdf' && pdfNumPages > 0 && !selection && (
        <div className="docnav">
          <button
            className="iconbtn"
            aria-label="Página anterior"
            disabled={pdfPage <= 1}
            onClick={() => {
              const p = Math.max(1, pdfPage - 1);
              setPdfPage(p);
              pdfRef.current?.scrollToPage(p);
            }}
          >
            <Icon name="chevron-left" />
          </button>
          <span className="docnav__counter">
            <input
              className="docnav__input"
              type="number"
              min={1}
              max={pdfNumPages}
              value={pdfPage}
              onChange={(e) => {
                const p = Math.min(pdfNumPages, Math.max(1, Number(e.target.value) || 1));
                setPdfPage(p);
                pdfRef.current?.scrollToPage(p);
              }}
              aria-label="Ir a la página"
            />
            <span className="docnav__total">/ {pdfNumPages}</span>
          </span>
          <button
            className="iconbtn"
            aria-label="Página siguiente"
            disabled={pdfPage >= pdfNumPages}
            onClick={() => {
              const p = Math.min(pdfNumPages, pdfPage + 1);
              setPdfPage(p);
              pdfRef.current?.scrollToPage(p);
            }}
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      )}

      {/* Barra lookup con manejo de error tipado y botón Reintentar */}
      {selection && (
        <div className="lookup" onClick={(e) => e.stopPropagation()}>
          <div className="lookup__texts">
            <p className="lookup__source">{selection.text}</p>
            {translating && <p className="lookup__target">Traduciendo…</p>}
            {!translating && translationErr && (
              <p className="lookup__error">
                {translationErr.message}
                {translationErr.retryable && (
                  <button
                    className="lookup__retry"
                    onClick={() => void runTranslation(selection.text)}
                  >
                    Reintentar
                  </button>
                )}
              </p>
            )}
            {!translating && !translationErr && (
              <p className="lookup__target">{translation ?? '—'}</p>
            )}
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

/** Entrada del TOC (Table of Contents) de un documento. */
export interface TocItem {
  label: string;
  href: string;
  /** Nivel de anidamiento para la indentación visual (0 = raíz). */
  level?: number;
}

/** Resultado de una búsqueda dentro del documento. */
export interface SearchResult {
  /** Extracto de texto con el término encontrado. */
  excerpt: string;
  /** Número de página (PDF, base 1) o undefined si es EPUB. */
  page?: number;
  /** CFI de posición (EPUB) o undefined si es PDF. */
  cfi?: string;
}
