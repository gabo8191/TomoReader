import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { api } from '@/lib/api';
import type { Comic, Pocket } from '@/types';

/** Extrae el nombre de archivo de una ruta absoluta (Windows o Unix). */
const fileName = (path: string): string => path.split(/[/\\]/).pop() ?? path;

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

  const setError = (error: unknown) =>
    setState((s) => ({ ...s, error: error instanceof Error ? error.message : String(error) }));

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
      filters: [{ name: 'Cómics', extensions: ['cbr', 'cbz'] }],
    });
    if (!selection) return;
    const paths = Array.isArray(selection) ? selection : [selection];
    try {
      const result = await api.importComics(paths, state.selectedPocket);
      await Promise.all([refreshPockets(), loadComics(state.selectedPocket)]);
      // Reporta los archivos que no se pudieron importar, con su motivo.
      if (result.failed.length > 0) {
        const detail = result.failed.map((f) => `${fileName(f.path)}: ${f.reason}`).join('\n');
        setError(`No se pudieron importar ${result.failed.length} archivo(s):\n${detail}`);
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
