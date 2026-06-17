import { useCallback, useEffect, useState } from 'react';
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

interface DocState {
  data: ArrayBuffer | null;
  format: 'pdf' | 'epub' | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook del lector de documentos (PDF/EPUB): carga los bytes del archivo, mantiene
 * los resaltados/vocabulario y expone traducción e idioma del libro. La lógica de
 * render concreta vive en EpubView/PdfView; aquí está todo lo compartido.
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

  // Traduce del idioma del libro (o auto) al idioma materno.
  const translate = useCallback(
    (text: string): Promise<Translation> => api.translate(text, language ?? 'auto', nativeLanguage),
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

  return {
    ...doc,
    highlights,
    language,
    nativeLanguage,
    translate,
    addHighlight,
    removeHighlight,
    saveCover,
    setLanguage,
  };
}
