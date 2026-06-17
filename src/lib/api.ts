import { invoke } from '@tauri-apps/api/core';
import type { Comic, ComicSession, ImportResult, PageImage, Pocket } from '@/types';

/**
 * Capa de acceso a los comandos del backend Rust.
 * Centraliza todas las llamadas `invoke` para mantener el contrato en un solo lugar
 * y evitar strings mágicos repartidos por la UI.
 */
export const api = {
  // ── Pockets ────────────────────────────────────────────────
  listPockets(): Promise<Pocket[]> {
    return invoke('list_pockets');
  },
  createPocket(name: string, color: string): Promise<Pocket> {
    return invoke('create_pocket', { name, color });
  },
  renamePocket(id: number, name: string): Promise<void> {
    return invoke('rename_pocket', { id, name });
  },
  deletePocket(id: number): Promise<void> {
    return invoke('delete_pocket', { id });
  },

  // ── Cómics ─────────────────────────────────────────────────
  listComics(pocketId: number | null): Promise<Comic[]> {
    return invoke('list_comics', { pocketId });
  },
  importComics(paths: string[], pocketId: number | null): Promise<ImportResult> {
    return invoke('import_comics', { paths, pocketId });
  },
  deleteComic(id: number): Promise<void> {
    return invoke('delete_comic', { id });
  },
  moveComic(id: number, pocketId: number | null): Promise<void> {
    return invoke('move_comic', { id, pocketId });
  },

  // ── Lectura ────────────────────────────────────────────────
  openComic(id: number): Promise<ComicSession> {
    return invoke('open_comic', { id });
  },
  closeComic(id: number): Promise<void> {
    return invoke('close_comic', { comicId: id });
  },
  getPage(comicId: number, index: number): Promise<PageImage> {
    return invoke('get_page', { comicId, index });
  },
  updateProgress(comicId: number, lastPage: number): Promise<void> {
    return invoke('update_progress', { comicId, lastPage });
  },
};
