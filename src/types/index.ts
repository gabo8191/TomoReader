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

/** Formato de un archivo de la biblioteca. */
export type ComicFormat = 'cbr' | 'cbz' | 'pdf' | 'epub';

/** Formatos de documento (texto) con funciones tipo Kindle. */
export const DOCUMENT_FORMATS: ComicFormat[] = ['pdf', 'epub'];

/** Indica si un formato es un documento (PDF/EPUB) y no un cómic de imágenes. */
export const isDocumentFormat = (format: ComicFormat): boolean => DOCUMENT_FORMATS.includes(format);

/** Un cómic/manga/documento importado a la biblioteca. */
export interface Comic {
  id: number;
  pocketId: number | null;
  title: string;
  /** Ruta absoluta del archivo en disco. */
  path: string;
  format: ComicFormat;
  pageCount: number;
  /** Última página leída (índice base 0). */
  lastPage: number;
  /** Miniatura de portada como data URL (base64), o null si no se pudo generar. */
  cover: string | null;
  /** Idioma del libro (código ISO, p. ej. "en"), o null para autodetectar. */
  language: string | null;
  addedAt: string;
}

/** Contenido de un documento PDF/EPUB para renderizar en el webview. */
export interface DocumentData {
  /** Bytes del archivo en base64. */
  dataBase64: string;
  format: 'pdf' | 'epub';
}

/** Resultado de una traducción. */
export interface Translation {
  translation: string;
  detectedSource: string | null;
}

/** Frase o palabra resaltada/guardada (vocabulario tipo Kindle). */
export interface Highlight {
  id: number;
  comicId: number;
  kind: 'word' | 'phrase';
  text: string;
  translation: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  /** Ancla de posición: CFI (EPUB) o página+rects (PDF) serializado. */
  location: string | null;
  color: string;
  note: string | null;
  createdAt: string;
}

/** Datos para crear un resaltado. */
export interface NewHighlight {
  comicId: number;
  kind: 'word' | 'phrase';
  text: string;
  translation?: string | null;
  sourceLang?: string | null;
  targetLang?: string | null;
  location?: string | null;
  color?: string | null;
  note?: string | null;
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
