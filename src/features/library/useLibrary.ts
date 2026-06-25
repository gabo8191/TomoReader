import { useCallback, useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast-store';
import type { Comic, ComicFormat, Pocket } from '@/types';

/** Extrae el nombre de archivo de una ruta absoluta (Windows o Unix). */
const fileName = (path: string): string => path.split(/[/\\]/).pop() ?? path;

/** Criterio de orden de la biblioteca. */
export type SortBy = 'recent' | 'oldest' | 'title';

/** Filtros aplicados en cliente sobre la lista de cómics ya cargada. */
export interface LibraryFilters {
  /** Formatos visibles; vacío = todos. */
  formats: ComicFormat[];
  /** Solo libros añadidos a partir de esta fecha (YYYY-MM-DD); '' = sin límite. */
  since: string;
  sortBy: SortBy;
}

const DEFAULT_FILTERS: LibraryFilters = { formats: [], since: '', sortBy: 'recent' };

interface LibraryState {
  pockets: Pocket[];
  comics: Comic[];
  /** Pocket seleccionado; null significa "Todos". */
  selectedPocket: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook que encapsula todo el estado y las operaciones de la biblioteca.
 * Mantiene la UI desacoplada de la capa `api` y centraliza el manejo de errores.
 */
export function useLibrary() {
  const [state, setState] = useState<LibraryState>({
    pockets: [],
    comics: [],
    selectedPocket: null,
    loading: true,
    error: null,
  });

  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS);

  const setError = (error: unknown) =>
    setState((s) => ({ ...s, error: error instanceof Error ? error.message : String(error) }));

  // Lista visible: aplica filtros de formato/fecha y orden sobre los cómics cargados.
  const visibleComics = useMemo(() => {
    const filtered = state.comics.filter((c) => {
      if (filters.formats.length > 0 && !filters.formats.includes(c.format)) return false;
      // addedAt viene como "YYYY-MM-DD HH:MM:SS"; comparar por prefijo de fecha basta.
      if (filters.since && c.addedAt.slice(0, 10) < filters.since) return false;
      return true;
    });
    const sorted = [...filtered];
    switch (filters.sortBy) {
      case 'recent':
        sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
        break;
      case 'oldest':
        sorted.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [state.comics, filters]);

  const toggleFormat = useCallback((format: ComicFormat) => {
    setFilters((f) => ({
      ...f,
      formats: f.formats.includes(format)
        ? f.formats.filter((x) => x !== format)
        : [...f.formats, format],
    }));
  }, []);

  const setSince = useCallback((since: string) => setFilters((f) => ({ ...f, since })), []);
  const setSortBy = useCallback((sortBy: SortBy) => setFilters((f) => ({ ...f, sortBy })), []);

  const refreshPockets = useCallback(async () => {
    const pockets = await api.listPockets();
    setState((s) => ({ ...s, pockets }));
  }, []);

  const loadComics = useCallback(async (pocketId: number | null) => {
    setState((s) => ({ ...s, loading: true, selectedPocket: pocketId }));
    try {
      const comics = await api.listComics(pocketId);
      setState((s) => ({ ...s, comics, loading: false }));
    } catch (err) {
      setError(err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  // Carga inicial.
  useEffect(() => {
    void (async () => {
      try {
        await refreshPockets();
        await loadComics(null);
      } catch (err) {
        setError(err);
      }
    })();
  }, [refreshPockets, loadComics]);

  const importComics = useCallback(async () => {
    const selection = await open({
      multiple: true,
      filters: [{ name: 'Libros', extensions: ['cbr', 'cbz', 'pdf', 'epub'] }],
    });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    try {
      const result = await api.importComics(paths, state.selectedPocket);
      await Promise.all([refreshPockets(), loadComics(state.selectedPocket)]);
      // Importación exitosa: toast informativo con el resultado.
      if (result.imported.length > 0 && result.failed.length === 0) {
        toast.success(`${result.imported.length} libro(s) importado(s) correctamente.`);
      }
      // Fallos parciales o totales: toast de error no bloqueante (reemplaza el error inline).
      if (result.failed.length > 0) {
        const detail = result.failed.map((f) => `${fileName(f.path)}: ${f.reason}`).join(' · ');
        toast.error(`${result.failed.length} archivo(s) no importado(s): ${detail}`, 6000);
      }
    } catch (err) {
      setError(err);
    }
  }, [state.selectedPocket, refreshPockets, loadComics]);

  const createPocket = useCallback(
    async (name: string, color: string) => {
      try {
        await api.createPocket(name, color);
        await refreshPockets();
      } catch (err) {
        setError(err);
      }
    },
    [refreshPockets],
  );

  const deletePocket = useCallback(
    async (id: number) => {
      try {
        await api.deletePocket(id);
        await refreshPockets();
        if (state.selectedPocket === id) await loadComics(null);
      } catch (err) {
        setError(err);
      }
    },
    [refreshPockets, loadComics, state.selectedPocket],
  );

  const deleteComic = useCallback(
    async (id: number) => {
      try {
        await api.deleteComic(id);
        await Promise.all([refreshPockets(), loadComics(state.selectedPocket)]);
      } catch (err) {
        setError(err);
      }
    },
    [refreshPockets, loadComics, state.selectedPocket],
  );

  const renamePocket = useCallback(
    async (id: number, name: string) => {
      try {
        await api.renamePocket(id, name);
        await refreshPockets();
      } catch (err) {
        setError(err);
      }
    },
    [refreshPockets],
  );

  const moveComic = useCallback(
    async (id: number, pocketId: number | null) => {
      try {
        await api.moveComic(id, pocketId);
        await Promise.all([refreshPockets(), loadComics(state.selectedPocket)]);
      } catch (err) {
        setError(err);
      }
    },
    [refreshPockets, loadComics, state.selectedPocket],
  );

  return {
    ...state,
    visibleComics,
    filters,
    toggleFormat,
    setSince,
    setSortBy,
    loadComics,
    importComics,
    createPocket,
    deletePocket,
    renamePocket,
    deleteComic,
    moveComic,
    dismissError: () => setState((s) => ({ ...s, error: null })),
  };
}
