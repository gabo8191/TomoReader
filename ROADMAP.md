# ROADMAP — TomoReader hacia 1.0

Estado a fecha **2026-06-24** (rama `main`, versión `1.0.0`).

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

## ✅ Cerrado en 1.0-rc (2026-06-23)

### P0 — Cerrados
- [x] **Vulnerabilidades de `epubjs`** — Resuelto con `overrides["@xmldom/xmldom": ">=0.9.0"]`
      en `package.json`. `npm audit` reporta 0 high. No fue necesario subir a `epubjs@0.4.2`.
      Documentado en ADR-002.
- [x] **Robustez de la traducción** — Caché en memoria por clave `source|target|text` en
      `useDocReader`. 1 reintento con backoff 600 ms. `TranslationError` tipado con `retryable`
      y botón «Reintentar» en la barra lookup.
- [x] **Toasts no bloqueantes** — Store Zustand + componente `Toaster` (sin librerías nuevas).
      Importación y traducción conectadas.
- [x] **Progreso de lectura en documentos** — `saveProgress` en `useDocReader` (debounce 600 ms).
      PDF: `onPageChange` + `initialPage` en `PdfView`. EPUB: `onRelocated` + `initialCfi` en
      `EpubView`. Documento nunca leído arranca en inicio sin error.
- [x] **Render PDF perezoso** — `IntersectionObserver` con `rootMargin=100%`; contenedores con
      alto reservado (sin CLS); canvas/textLayer se crean al entrar y se eliminan al salir.
      Función pura `nearestPageInViewport` extraída a `pdfUtils.ts` y testeada.

### P1 — Cerrados
- [x] **TOC y búsqueda** — Panel lateral con pestañas en `DocReader`. EPUB: `book.navigation.toc`
      + `spine.find()`. PDF: `getOutline()` + `getTextContent()` por página. Resultados clicables.
- [x] **Gestión de resaltados desde el lector** — Panel lateral con lista de resaltados; edición
      inline de nota, borrar y «Ir a» (EPUB: CFI, PDF: scroll a página). `updateNote` en
      `useDocReader`.
- [x] **Estados vacíos y onboarding** — `ComicGrid` diferencia «biblioteca vacía» (con icono y CTA
      «Importar libros») de «filtro sin resultados» (mensaje distinto). `emptyContext` prop.
- [x] **Accesibilidad** — Roving tabindex en la grilla (flechas + Enter). `:focus-visible` global
      en todos los controles interactivos. `aria-label` en botones icónicos y `role`/`aria-*`
      en cards y progressbar.

## 🚧 Pendiente para 1.0

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

- **1.0.0** (2026-06-24) — Primer lanzamiento estable. Compilado tras QA completo
  (lint, typecheck, 29 tests front, clippy, 10 tests Rust, `npm audit` 0 vulns).
  Bundles Linux (rpm/deb/appimage). P2 (cobertura extra, Win/macOS, auto-update) queda
  como mejora post-1.0.
- **1.0-rc** — P0+P1 cerrados: progreso de lectura, render PDF perezoso, traducción robusta,
  vulnerabilidades epubjs, TOC+búsqueda, panel de resaltados, toasts, onboarding, accesibilidad.
- **0.2.0** — Portadas PDF/EPUB, resaltado PDF por coordenadas, code-splitting del bundle.
- **0.1.2** — Lector PDF/EPUB tipo Kindle, vocabulario, filtros; fix del error de E/S en CBR.
