# ROADMAP — TomoReader hacia 1.0

Estado a fecha **2026-06-17** (rama `feat/pdf-epub-kindle`, versión `0.2.0`).

Este documento resume qué está terminado y qué falta para considerar TomoReader una
versión **1.0** estable. Mantenerlo actualizado al cerrar cada punto.

---

## ✅ Hecho

### Núcleo (cómics CBR/CBZ)
- Importación a biblioteca propia (`app_data_dir/library`), idempotente.
- Lector de imágenes con sesiones; `close_comic` evita el «error de E/S» al reabrir CBR.
- Importación resiliente: los fallos se reportan en `ImportResult.failed` y la UI los muestra.
- Pockets (carpetas), portadas (miniatura JPEG), progreso de lectura por página.

### Documentos (PDF/EPUB) — experiencia tipo Kindle
- Render en el webview: PDF con pdf.js, EPUB con epub.js (selección de texto nativa).
- Traducción de selección (Google Translate gratuito vía Rust, evita CORS).
- Resaltado + guardado de vocabulario; listado en `VocabularyView`.
- Idioma por libro (`set_comic_language`) e idioma materno global (`nativeLanguage`).
- Filtros de biblioteca por formato, fecha de adición y orden; filtro por pocket.

### Pulido reciente (v0.2.0)
- **Portadas PDF/EPUB**: EPUB se extrae del OPF/ZIP en backend; PDF se rasteriza la
  página 1 en el frontend y se persiste con `set_comic_cover`.
- **Resaltado PDF por coordenadas**: se guardan rects normalizados `{page, rects[]}` y
  se repintan como overlays; compatibilidad hacia atrás con resaltado por texto.
- **Code-splitting**: pdf.js/epub.js cargan con `React.lazy` → desaparece el warning de
  tamaño de bundle de Vite (chunk principal ~175 kB).

---

## 🚧 Pendiente para 1.0

### P0 — Bloqueantes de calidad/estabilidad
- [ ] **Progreso de lectura en documentos.** Hoy `lastPage` solo aplica a imágenes.
      Persistir posición en PDF (página) y EPUB (CFI) y restaurarla al reabrir.
- [ ] **Render PDF perezoso.** `PdfView` renderiza *todas* las páginas al abrir; en PDFs
      grandes es lento y consume mucha memoria. Virtualizar (renderizar por viewport con
      `IntersectionObserver`).
- [ ] **Robustez de la traducción.** El endpoint de Google es no oficial y puede limitar
      o caer. Añadir manejo de error claro en UI, reintento básico y caché en memoria de
      traducciones repetidas. Documentar el riesgo en el README.
- [ ] **Vulnerabilidades de `epubjs`** (`npm audit`). Evaluar fijar versión, parche, o
      alternativa. Dejar registrada la decisión.

### P1 — Funcionalidad esperable en un lector 1.0
- [ ] Gestión de resaltados desde el lector (ver/editar nota/borrar sin ir a Vocabulario).
- [ ] Índice/TOC y búsqueda dentro del documento (EPUB y PDF).
- [ ] Toasts/errores no bloqueantes en vez de mensajes inline (importación, traducción).
- [ ] Estados vacíos y onboarding mínimo (biblioteca vacía, primer import).
- [ ] Accesibilidad: navegación por teclado en la grilla y foco visible.

### P2 — Distribución y mantenimiento
- [ ] **Cobertura de tests.** Hoy es mínima (settings-store + ordenación natural + parser
      EPUB). Añadir: repositorio (insert/idempotencia), import_comics (fallos), parser de
      portada EPUB con un `.epub` de fixture, anclas de resaltado PDF.
- [ ] Pruebas en Windows/macOS (hoy solo se generan bundles Linux: rpm/deb/appimage).
- [ ] Auto-actualización (plugin updater de Tauri) — opcional pero recomendable.
- [ ] CI: ejecutar `cargo test`/`clippy` + `lint`/`typecheck`/`test` en cada PR (verificar
      que el workflow ya cubre backend tras el build del frontend).

---

## Notas de versión

- **0.2.0** — Portadas PDF/EPUB, resaltado PDF por coordenadas, code-splitting del bundle.
- **0.1.2** — Lector PDF/EPUB tipo Kindle, vocabulario, filtros; fix del error de E/S en CBR.
