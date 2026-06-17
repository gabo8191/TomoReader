// Contrato de datos compartido con el backend Rust.
// Debe mantenerse sincronizado con `src-tauri/src/library/models.rs`.

/** Carpeta/pocket que agrupa cómics o mangas. */
export interface Pocket {
  id: number;
  name: string;
  /** Color hex de acento, p. ej. "#F5A623". */
  color: string;
  comicCount: number;
  createdAt: string;
}

/** Un cómic/manga importado a la biblioteca. */
export interface Comic {
  id: number;
  pocketId: number | null;
  title: string;
  /** Ruta absoluta del archivo CBR/CBZ en disco. */
  path: string;
  format: 'cbr' | 'cbz';
  pageCount: number;
  /** Última página leída (índice base 0). */
  lastPage: number;
  /** Miniatura de portada como data URL (base64), o null si no se pudo generar. */
  cover: string | null;
  addedAt: string;
}

/** Archivo que no se pudo importar, con el motivo para mostrar al usuario. */
export interface ImportFailure {
  path: string;
  reason: string;
}

/** Resultado de un lote de importación: lo importado y lo que falló. */
export interface ImportResult {
  imported: Comic[];
  failed: ImportFailure[];
}

/** Resultado de abrir un cómic: sesión lista para leer. */
export interface ComicSession {
  comicId: number;
  pageCount: number;
  lastPage: number;
}

/** Una página renderizable. */
export interface PageImage {
  index: number;
  /** Imagen como data URL lista para usar en <img src>. */
  dataUrl: string;
}

/** Modo de ajuste de página en el lector. */
export type FitMode = 'width' | 'height' | 'original';

/** Tema visual orientado a reducir fatiga visual. */
export type ReadingTheme = 'dark' | 'oled' | 'sepia' | 'light';

/** Dirección de lectura (los mangas suelen ser de derecha a izquierda). */
export type ReadingDirection = 'ltr' | 'rtl';
