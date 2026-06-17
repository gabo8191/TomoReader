import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface ReaderState {
  pageCount: number;
  current: number;
  /** data URL de la página actual, o null mientras carga. */
  src: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook del lector: abre el cómic, carga páginas bajo demanda con una caché
 * simple en memoria y prefetch de la siguiente página para una lectura fluida.
 * Persiste el progreso de forma debounced para no saturar la BD.
 */
export function useReader(comicId: number) {
  const [state, setState] = useState<ReaderState>({
    pageCount: 0,
    current: 0,
    src: null,
    loading: true,
    error: null,
  });

  // Caché de páginas ya descargadas (índice -> data URL).
  const cache = useRef<Map<number, string>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (index: number): Promise<string | null> => {
      const cached = cache.current.get(index);
      if (cached) return cached;
      try {
        const page = await api.getPage(comicId, index);
        cache.current.set(index, page.dataUrl);
        return page.dataUrl;
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
        return null;
      }
    },
    [comicId],
  );

  // Abre la sesión al montar.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await api.openComic(comicId);
        if (!active) return;
        setState((s) => ({
          ...s,
          pageCount: session.pageCount,
          current: session.lastPage,
          loading: false,
        }));
      } catch (err) {
        if (!active) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
    return () => {
      active = false;
      // Libera la sesión y las páginas temporales (CBR) al salir del lector.
      void api.closeComic(comicId);
    };
  }, [comicId]);

  // Valores primitivos derivados del estado, usados como dependencias estables.
  const { current, pageCount } = state;

  // Carga la página actual y prefetch de la siguiente cuando cambia el índice.
  useEffect(() => {
    if (pageCount === 0) return;
    let active = true;
    void (async () => {
      const src = await fetchPage(current);
      if (active) setState((s) => ({ ...s, src }));
      // Prefetch silencioso de la página siguiente.
      if (current + 1 < pageCount) void fetchPage(current + 1);
    })();
    return () => {
      active = false;
    };
  }, [current, pageCount, fetchPage]);

  // Persiste el progreso (debounced) cada vez que cambia la página.
  useEffect(() => {
    if (pageCount === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void api.updateProgress(comicId, current);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [comicId, current, pageCount]);

  const goTo = useCallback((index: number) => {
    setState((s) => {
      const clamped = Math.min(Math.max(index, 0), Math.max(s.pageCount - 1, 0));
      if (clamped === s.current) return s;
      return { ...s, current: clamped, src: cache.current.get(clamped) ?? null };
    });
  }, []);

  const next = useCallback(() => goTo(current + 1), [goTo, current]);
  const prev = useCallback(() => goTo(current - 1), [goTo, current]);

  return { ...state, goTo, next, prev };
}
