import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings-store';
import type { Comic, Highlight, NewHighlight, Translation } from '@/types';

/** Decodifica base64 a un ArrayBuffer para pdf.js/epub.js. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Error de traducción tipado que distingue error de red de texto vacío.
 * Extiende Error para poder usarse con `throw` sin warnings de lint.
 */
export class TranslationError extends Error {
  /** true cuando se puede reintentar (fallo de red, no texto vacío). */
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'TranslationError';
    this.retryable = retryable;
  }
}

interface DocState {
  data: ArrayBuffer | null;
  format: 'pdf' | 'epub' | null;
  loading: boolean;
  error: string | null;
}

/** Espera `ms` milisegundos antes de continuar. */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Clave de caché para una petición de traducción.
 * Combina source, target y texto para garantizar unicidad por sesión.
 */
const cacheKey = (text: string, source: string, target: string): string =>
  `${source}|${target}|${text}`;

/**
 * Llama a `api.translate` con 1 reintento ante fallo de red (backoff 600 ms).
 * Lanza el error original si el segundo intento también falla.
 */
async function translateWithRetry(
  text: string,
  source: string,
  target: string,
): Promise<Translation> {
  try {
    return await api.translate(text, source, target);
  } catch (firstErr) {
    // Primer fallo: espera 600 ms y reintenta una vez.
    await delay(600);
    try {
      return await api.translate(text, source, target);
    } catch {
      // Propaga el error original para que el mensaje sea coherente.
      throw firstErr;
    }
  }
}

/**
 * Hook del lector de documentos (PDF/EPUB): carga los bytes del archivo, mantiene
 * los resaltados/vocabulario y expone traducción e idioma del libro. La lógica de
 * render concreta vive en EpubView/PdfView; aquí está todo lo compartido.
 *
 * Incluye:
 * - Caché en memoria (Map) por clave `source|target|text` para evitar llamadas repetidas.
 * - 1 reintento con backoff de 600 ms ante fallos de red en la traducción.
 * - Estado de error tipado (`TranslationError`) que la UI puede usar para mostrar
 *   un botón «Reintentar» o un mensaje de texto vacío.
 */
export function useDocReader(comic: Comic) {
  const nativeLanguage = useSettings((s) => s.nativeLanguage);
  const [doc, setDoc] = useState<DocState>({
    data: null,
    format: null,
    loading: true,
    error: null,
  });
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [language, setLanguageState] = useState<string | null>(comic.language);

  // Caché de traducciones por sesión de lectura.
  // Se usa un ref para que no provoque re-renders al actualizarse.
  const translationCache = useRef<Map<string, Translation>>(new Map());

  // Carga el documento y sus resaltados al montar.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [document, saved] = await Promise.all([
          api.readDocument(comic.id),
          api.listHighlights(comic.id),
        ]);
        if (!active) return;
        setDoc({
          data: base64ToArrayBuffer(document.dataBase64),
          format: document.format,
          loading: false,
          error: null,
        });
        setHighlights(saved);
      } catch (err) {
        if (!active) return;
        setDoc((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
    return () => {
      active = false;
    };
  }, [comic.id]);

  /**
   * Traduce el texto dado del idioma del libro (o auto) al idioma materno.
   * - Devuelve el resultado de la caché si ya se tradujo antes.
   * - Reintenta 1 vez ante fallo de red (backoff 600 ms).
   * - Lanza `TranslationError` con `retryable` para que la UI distinga el tipo de error.
   */
  const translate = useCallback(
    async (text: string): Promise<Translation> => {
      const source = language ?? 'auto';
      const target = nativeLanguage;

      // Texto vacío: no llamar al backend.
      if (!text.trim()) {
        throw new TranslationError('Selecciona texto para traducir.', false);
      }

      const key = cacheKey(text, source, target);
      const cached = translationCache.current.get(key);
      if (cached) return cached;

      try {
        const result = await translateWithRetry(text, source, target);
        translationCache.current.set(key, result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TranslationError(`Error de traducción: ${msg}`, true);
      }
    },
    [language, nativeLanguage],
  );

  const addHighlight = useCallback(
    async (input: Omit<NewHighlight, 'comicId'>): Promise<Highlight> => {
      const created = await api.createHighlight({ ...input, comicId: comic.id });
      setHighlights((hs) => [created, ...hs]);
      return created;
    },
    [comic.id],
  );

  const removeHighlight = useCallback(async (id: number) => {
    await api.deleteHighlight(id);
    setHighlights((hs) => hs.filter((h) => h.id !== id));
  }, []);

  /** Actualiza la nota de un resaltado y sincroniza el estado local. */
  const updateNote = useCallback(async (id: number, note: string | null) => {
    await api.updateHighlightNote(id, note);
    setHighlights((hs) => hs.map((h) => (h.id === id ? { ...h, note } : h)));
  }, []);

  // Persiste la portada generada por el lector (página 1 del PDF rasterizada).
  const saveCover = useCallback(
    (cover: Uint8Array) => api.setComicCover(comic.id, cover),
    [comic.id],
  );

  const setLanguage = useCallback(
    async (lang: string | null) => {
      const normalized = lang && lang.trim() !== '' ? lang : null;
      setLanguageState(normalized);
      await api.setComicLanguage(comic.id, normalized);
    },
    [comic.id],
  );

  /**
   * Guarda el progreso de lectura del documento (debounce gestionado por el llamador).
   * - PDF: pasar `lastPage` (número base 0), `lastLocation` null.
   * - EPUB: pasar `lastLocation` (CFI), `lastPage` null.
   */
  const saveProgress = useCallback(
    (lastPage: number | null, lastLocation: string | null) =>
      api.updateDocProgress(comic.id, lastPage, lastLocation),
    [comic.id],
  );

  return {
    ...doc,
    highlights,
    language,
    nativeLanguage,
    translate,
    addHighlight,
    removeHighlight,
    updateNote,
    saveCover,
    setLanguage,
    saveProgress,
  };
}
