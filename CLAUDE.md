# CLAUDE.md — Contexto del proyecto TomoReader

Guía para que un asistente de IA (Claude Code) entienda y trabaje en este repositorio.
Mantén este archivo actualizado cuando cambien la arquitectura, los comandos o las
convenciones.

## Qué es

**TomoReader** es una app de escritorio (Tauri 2 + React) para leer **cómics/mangas**
(CBR/CBZ, basados en imágenes) y **documentos** (PDF/EPUB, basados en texto). Los
documentos tienen funciones tipo Kindle: selección de texto, traducción, resaltado y
vocabulario guardado.

## Stack

- **Backend**: Rust + Tauri 2. SQLite vía `rusqlite` (bundled). `zip` (CBZ), `unrar`
  (CBR), `image` (miniaturas), `reqwest` (traducción), `base64`, `thiserror`.
- **Frontend**: React 18 + TypeScript estricto + Vite. Estado con **Zustand**
  (preferencias en localStorage). pdf.js (`pdfjs-dist`) y epub.js (`epubjs`) para
  documentos.
- **Calidad**: ESLint (0 warnings), Prettier, Vitest, clippy, rustfmt. Husky +
  lint-staged en pre-commit. CI en GitHub Actions.

## Convenciones (heredadas del CLAUDE.md global del autor)

- **Responder siempre en español.** Variables y funciones en **inglés**, comentarios en
  **español**.
- **Patrón Repository**: TODO el SQL vive en `src-tauri/src/library/repository.rs`. El
  resto de la app nunca escribe SQL directo.
- Manejo de errores explícito con `AppError` (`src-tauri/src/error.rs`); nada de
  `unwrap()` en rutas de usuario ni `catch` vacíos en TS.
- Nada de `any` en TypeScript. Lógica fuera de los componentes (en hooks o en `api`).
- Migraciones idempotentes (`IF NOT EXISTS` / guarda de columnas). Nunca tocar el
  esquema fuera de `db.rs`.
- Antes de eliminar código o archivos, preguntar. Commits convencionales en inglés
  (`feat/fix/docs/refactor(scope): …`), una responsabilidad por commit.

## Arquitectura

```
src/                          # Frontend React (por features)
├── features/
│   ├── library/              # Pockets, grid, filtros, hook useLibrary
│   ├── reader/               # Lector de imágenes (ReaderView) y de documentos (DocReader)
│   ├── settings/             # Panel de preferencias (incl. idioma materno)
│   └── vocabulary/           # Listado de frases/palabras guardadas
├── lib/                      # api.ts (invoke), settings-store.ts, languages.ts
└── types/                    # Contrato compartido con Rust (mantener sincronizado)

src-tauri/src/                # Backend Rust
├── archive/                  # CBR/CBZ + Format (incl. pdf/epub) + ordenación natural
├── library/                  # models · db (migraciones) · repository (SQL)
├── commands/                 # comics · reader · documents · translate · highlights · pockets
├── state.rs · error.rs · util.rs
└── lib.rs (registro de comandos) · main.rs
```

### Dos lectores según el formato

`App.tsx` enruta por formato con `isDocumentFormat()` (`src/types/index.ts`):

- **CBR/CBZ → `ReaderView`** (`features/reader/`): el backend extrae/lee páginas como
  imágenes (`open_comic`/`get_page`) y la UI las muestra en `<img>`.
- **PDF/EPUB → `DocReader`** (`features/reader/DocReader.tsx`): el backend solo entrega
  los bytes (`read_document`); el render ocurre en el webview con pdf.js (`PdfView`) o
  epub.js (`EpubView`), lo que da **selección de texto nativa**.

### Flujo Kindle (solo PDF/EPUB)

Seleccionar texto → `onSelect(text, location)` → `DocReader` muestra la barra `lookup`
con la traducción (`translate`, idioma del libro → idioma materno) → botón «Resaltar y
guardar» crea un `highlight`. Persistencia del resaltado: **CFI** en EPUB (preciso vía
epub.js annotations), **página + coincidencia de texto** en PDF (aproximado).

## Modelo de datos (SQLite)

- `pockets` — carpetas (id, name, color, created_at).
- `comics` — id, pocket_id (FK SET NULL), title, path (UNIQUE), format, page_count,
  last_page, cover (BLOB), **language** (idioma del libro, nullable), added_at.
- `highlights` — id, comic_id (FK CASCADE), kind ('word'|'phrase'), text, translation,
  source_lang, target_lang, **location** (CFI o página serializada), color, note,
  created_at.

## Comandos Tauri (IPC) — en `lib.rs`, expuestos en `src/lib/api.ts`

Pockets: `list_pockets`, `create_pocket`, `rename_pocket`, `delete_pocket`.
Cómics: `list_comics`, `import_comics` (→ `ImportResult { imported, failed }`),
`move_comic`, `delete_comic`.
Lector imágenes: `open_comic`, `close_comic`, `get_page`, `update_progress`.
Documentos: `read_document`, `set_comic_language`.
Traducción: `translate`.
Highlights: `list_highlights`, `create_highlight`, `update_highlight_note`,
`delete_highlight`.

## Notas y gotchas importantes

- **Sesiones de lectura (CBR)**: `open_comic` guarda la sesión en `AppState.sessions`.
  Hay que llamar **`close_comic`** al salir del lector (lo hace `useReader` en el
  cleanup). No re-extraer un CBR con sesión viva: el `Drop` de `OpenedComic` borra el
  directorio temporal y provoca «error de E/S». `open_comic` reutiliza la sesión si ya
  existe.
- **Copia a biblioteca propia**: al importar se copia el archivo a `app_data_dir/library`
  y se guarda esa ruta, para no depender de la ubicación original.
- **Traducción**: usa el endpoint **gratuito no oficial** de Google
  (`translate.googleapis.com/translate_a/single`, `client=gtx`), llamado desde Rust para
  evitar CORS. No requiere API key, pero **no es oficial** y Google podría limitarlo.
- **CSP**: pdf.js/epub.js requieren `worker-src/script-src/frame-src/connect-src` con
  `blob:` en `tauri.conf.json`. Si añades recursos remotos, ajústala.
- **Tipos sincronizados**: `src/types/index.ts` debe reflejar los `struct` de
  `src-tauri/src/library/models.rs` y los comandos (serde usa `camelCase`).
- `tsconfig` con `noUncheckedIndexedAccess` y `strict`: cuidado al indexar arrays.

## Comandos de desarrollo

```bash
npm run tauri:dev      # app en desarrollo (hot-reload)
npm run tauri:build    # build de producción

# Calidad frontend
npm run lint && npm run typecheck && npm test

# Calidad backend
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test   --manifest-path src-tauri/Cargo.toml
```

## Pendientes / mejoras conocidas

- Portadas de PDF/EPUB (hoy se importan sin miniatura).
- Resaltado PDF por coordenadas exactas (hoy es por coincidencia de texto).
- Code-splitting del bundle (pdf.js/epub.js lo engordan; build emite warning de tamaño).
- `epubjs` arrastra dependencias con vulnerabilidades reportadas por `npm audit`.
