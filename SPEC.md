# SPEC.md — TomoReader 1.0 (cierre P0 + P1)

Especificación técnica de la planeación para llevar TomoReader de `0.2.0` a **1.0**.
Documento de **planeación**: ningún desarrollador implementa hasta que esté aprobado.
Decisiones de fondo registradas en `ADR.md`.

> Principio rector: **soluciones simples sobre arquitecturas sobreingeniadas**. Se
> respetan estrictamente las convenciones del proyecto (patrón Repository con todo el
> SQL en `repository.rs`, `AppError`/`thiserror`, nada de `unwrap()` en rutas de
> usuario, nada de `any` en TS, tipos sincronizados Rust↔TS en `src/types/index.ts`,
> migraciones idempotentes solo en `db.rs`, comentarios en español / código en inglés).
> **No** se añaden frameworks ni se migran patrones.

---

## 1. Objetivo de la 1.0

Una versión estable y usable de TomoReader como lector de cómics (CBR/CBZ) y
documentos (PDF/EPUB) con experiencia tipo Kindle, en la que:

- El usuario **reanuda la lectura** de cualquier documento donde la dejó.
- Los PDF grandes **se abren rápido y sin agotar memoria** (render por viewport).
- La traducción **no rompe la experiencia** ante fallos de red (error claro, reintento, caché).
- Las **vulnerabilidades de `epubjs`** tienen una decisión registrada y un plan.
- El usuario **gestiona sus resaltados** desde el propio lector.
- Existe **TOC y búsqueda** dentro del documento.
- La UI usa **avisos no bloqueantes**, **estados vacíos/onboarding** y es **navegable por teclado**.

Sin cambios de stack ni de arquitectura. Se mantiene SQLite + IPC Tauri + dos lectores
(`ReaderView` imágenes / `DocReader` documentos).

---

## 2. Alcance P0 + P1, orden y dependencias

| # | Item | Prioridad | Depende de | Riesgo |
|---|------|-----------|------------|--------|
| 1 | Progreso de lectura en documentos (PDF página / EPUB CFI) | P0 | — | Bajo |
| 2 | Render PDF perezoso/virtualizado por viewport | P0 | — (sinergia con #1) | Medio |
| 3 | Robustez de traducción (error UI + reintento + caché memoria) | P0 | — | Bajo |
| 4 | Vulnerabilidades de `epubjs` (decisión registrada) | P0 | — | Medio |
| 5 | Gestión de resaltados desde el lector | P1 | #1 (posicionar) opcional | Bajo |
| 6 | TOC + búsqueda dentro del documento (EPUB y PDF) | P1 | #2 (saltar a página PDF) | Medio |
| 7 | Toasts / errores no bloqueantes | P1 | — | Bajo |
| 8 | Estados vacíos y onboarding mínimo | P1 | — | Bajo |
| 9 | Accesibilidad: teclado en grilla + foco visible | P1 | — | Bajo |

**Orden recomendado de implementación:** 4 → 3 → 7 → 1 → 2 → 6 → 5 → 8 → 9.
(Primero la decisión de dependencia #4 y las bases transversales de UX #3/#7, luego
las funcionalidades del lector que se apoyan entre sí, y al final el pulido #8/#9.)

---

## 3. Detalle por item

### Item 1 — Progreso de lectura en documentos (P0)

**Problema:** `last_page` solo se usa en el lector de imágenes. En PDF/EPUB no se
guarda ni se restaura la posición.

**Enfoque simple:**
- PDF: la posición es un **número de página** → reutiliza la columna existente `last_page`.
- EPUB: la posición es un **CFI** (string) → nueva columna `last_location TEXT` en `comics`.
- Persistencia *debounced* (mismo patrón que `useReader`, 600 ms) al cambiar de página/relocate.
- Al abrir, `DocReader`/`useDocReader` ya recibe el `Comic` completo: pasa `comic.lastPage`
  a `PdfView` y `comic.lastLocation` a `EpubView` para posicionar tras el render inicial.

**Esquema / migración (`src-tauri/src/library/db.rs`):**
```text
add_column_if_missing(conn, "comics", "last_location", "TEXT")   // idempotente
```

**Repository (`src-tauri/src/library/repository.rs`):**
- Extender `row_to_comic` para leer `last_location`.
- Nueva fn `update_doc_progress(conn, id, last_page: Option<i64>, last_location: Option<&str>)`
  que actualiza solo los campos provistos (UPDATE simple, sin SQL fuera del repo).

**Contrato IPC:**
- Nuevo comando `update_doc_progress` (en `commands/documents.rs`, registrado en `lib.rs`),
  firma: `{ comicId: number, lastPage: number | null, lastLocation: string | null }`.
  Se prefiere comando nuevo a sobrecargar `update_progress` (imágenes) para no mezclar semánticas.
- `api.ts`: `updateDocProgress(comicId, lastPage, lastLocation)`.

**Tipos (`src/types/index.ts` + `models.rs`):**
- Añadir `lastLocation: string | null` a `Comic` (Rust: `last_location: Option<String>`).

**Archivos que toca:**
- `src-tauri/src/library/db.rs`, `repository.rs`, `models.rs`
- `src-tauri/src/commands/documents.rs`, `src-tauri/src/lib.rs`
- `src/types/index.ts`, `src/lib/api.ts`
- `src/features/reader/useDocReader.ts` (estado de progreso + guardado debounced)
- `src/features/reader/PdfView.tsx` (saltar a `initialPage`, emitir página actual)
- `src/features/reader/EpubView.tsx` (`display(initialCfi)`, evento `relocated` → CFI)

**Criterios de aceptación:**
- Abrir un PDF, ir a la página N, cerrar y reabrir → arranca en N.
- Abrir un EPUB, avanzar varios capítulos, cerrar y reabrir → arranca en la misma posición (CFI).
- Documento nunca leído → arranca en página 1 / inicio sin error.

**Tests:**
- Rust (`src-tauri/src/library/repository.rs` `#[cfg(test)]` o `tests/`): `update_doc_progress`
  persiste `last_page` y `last_location` de forma independiente; idempotencia de la migración.
- Frontend (Vitest): util de extracción de progreso (cálculo del payload a guardar dado
  formato + valor); no se testea el render de pdf.js/epub.js (DOM pesado).

---

### Item 2 — Render PDF perezoso / virtualizado (P0)

**Problema:** `PdfView` renderiza **todas** las páginas al abrir (bucle `for n in 1..=numPages`).
En PDFs grandes es lento y consume mucha memoria.

**Enfoque simple (sin librería nueva):**
- Crear de inmediato los contenedores `.pdfpage` con **tamaño reservado** (alto/ancho del
  viewport calculado por `getViewport`), pero **sin renderizar** canvas ni textLayer.
  Esto preserva el layout/scroll y evita CLS.
- Un `IntersectionObserver` (con `rootMargin` ~ 1 viewport) **renderiza la página al entrar**
  y **descarta el canvas al salir** (libera memoria), reaplicando resaltados al re-render.
- Guardar el número de página visible más cercano al tope del viewport → alimenta el
  progreso del Item 1 (sinergia) y el TOC del Item 6.
- Mantener el `slice(0)` del ArrayBuffer y el worker actuales.

**Sin cambios de esquema ni IPC.** Trabajo localizado en el frontend.

**Archivos que toca:**
- `src/features/reader/PdfView.tsx` (reescritura de la estrategia de render)
- `src/features/reader/docreader.css` (placeholder de página con alto reservado)

**Criterios de aceptación:**
- Abrir un PDF de 200+ páginas: la apertura es perceptiblemente rápida (no se renderizan
  todas) y el scroll dibuja páginas bajo demanda.
- La selección de texto y los resaltados siguen funcionando en páginas visibles.
- La portada (página 1) se sigue rasterizando y persistiendo igual que hoy.

**Tests:**
- Frontend: función pura `nearestPageInViewport(scrollTop, pageOffsets)` y la lógica de
  "qué páginas renderizar" extraída a helper testeable. (El observer y el canvas no se
  testean en jsdom.)
- Verificación manual documentada en el PR (no hay E2E en el repo).

---

### Item 3 — Robustez de la traducción (P0)

**Problema:** el endpoint gratuito no oficial de Google puede limitar/fallar; hoy el error
se muestra crudo en la barra `lookup` y no hay reintento ni caché.

**Enfoque simple:**
- **Caché en memoria** (frontend) por clave `source|target|text` en `useDocReader`
  (un `Map` en `useRef`), TTL no necesario (sesión de lectura). Evita repetir llamadas.
- **Reintento básico**: 1 reintento con backoff corto (p. ej. 600 ms) ante error de red,
  hecho en el frontend (no toca Rust) o en `translate.rs` con un loop pequeño. Se prefiere
  **frontend** para mantener `translate.rs` simple y sin estado.
- **Error claro en UI**: distinguir "sin conexión / servicio no disponible" de "texto vacío".
  Mostrar mensaje accionable + botón "Reintentar" en la barra `lookup`.
- **Documentar el riesgo** en `README.md` (endpoint no oficial, puede limitarse).

**Sin cambios de esquema ni IPC** (se reutiliza el comando `translate` existente).

**Archivos que toca:**
- `src/features/reader/useDocReader.ts` (caché + reintento + estado de error tipado)
- `src/features/reader/DocReader.tsx` (UI de error + botón reintentar)
- `src/features/reader/docreader.css` (estilo del estado de error)
- `README.md` (nota de riesgo)

**Criterios de aceptación:**
- Traducir dos veces la misma selección → la segunda no hace llamada de red (caché).
- Forzar fallo de red → la barra muestra error legible y botón "Reintentar" funcional.
- Selección vacía → no se llama al backend.

**Tests:**
- Frontend (Vitest): la caché devuelve el valor memorizado sin invocar `api.translate`;
  el reintento se dispara una vez ante error y luego propaga el error final. (Mock de `api`.)

---

### Item 4 — Vulnerabilidades de `epubjs` (P0)

**Hallazgo verificado (`npm audit`, 2026-06):** 2 advisories **high** que provienen de la
dependencia transitiva **`@xmldom/xmldom <= 0.8.12`** (XML injection / DoS por recursión),
arrastrada por **`epubjs@0.3.93`**. El `audit fix --force` propone `epubjs@0.4.2`, que es
**breaking change**. (Nota: el `AUDIT.md` antiguo atribuía las vulnerabilidades a `esbuild`;
queda corregido aquí: hoy provienen de `epubjs`.)

**Evaluación:**
- `@xmldom/xmldom` se usa para parsear el XML/OPF del EPUB. La superficie de ataque exige
  **abrir un EPUB malicioso** que el propio usuario importa; no hay red ni contenido remoto.
  Riesgo **real moderado**, pero no debe ignorarse para 1.0.
- Subir a `epubjs@0.4.x` es la vía de parche oficial pero implica revalidar el render,
  el evento `selected`, `annotations.highlight`, `display(cfi)` y `relocated`.

**Decisión propuesta (ver ADR-002, requiere confirmación del usuario):**
Intentar **fijar/actualizar la cadena de dependencia** sin romper la API que usamos:
1. Primero, forzar una versión parcheada de `@xmldom/xmldom` (>= 0.9.x) vía **`overrides`**
   en `package.json` y validar que el render EPUB sigue intacto (caso simple, sin tocar `epubjs`).
2. Si `epubjs@0.3.93` es incompatible con el `xmldom` parcheado, evaluar subir a `epubjs@0.4.2`
   detrás de una rama de prueba con los criterios de aceptación de EPUB del Item 1/5/6.
3. Si ninguna funciona sin regresiones, **documentar el riesgo residual** y posponer el
   cambio mayor, dejando el `override` que mitigue lo que sea posible.

**Archivos que toca:**
- `package.json` (campo `overrides`, o bump de `epubjs` según resultado)
- `package-lock.json`
- `ADR.md` (ADR-002) y `AUDIT.md` (corregir el origen del advisory)

**Criterios de aceptación:**
- `npm audit` ya no reporta los 2 high de `@xmldom/xmldom`, **o** queda registrado en ADR-002
  por qué se acepta el riesgo residual y con qué mitigación.
- El render EPUB, la selección, el resaltado y el posicionamiento por CFI siguen pasando
  sus criterios de aceptación (Items 1, 5, 6) tras el cambio.

**Tests:**
- `npm audit` en CI como verificación.
- Re-ejecución de los criterios de aceptación de EPUB (manual + Vitest de los helpers).

---

### Item 5 — Gestión de resaltados desde el lector (P1)

**Problema:** hoy los resaltados solo se ven/borran desde `VocabularyView`. Falta ver,
editar nota y borrar **dentro del lector**, y saltar a su posición.

**Enfoque simple:**
- Panel lateral/desplegable en `DocReader` que lista `doc.highlights` (ya cargados).
- Por cada resaltado: ver texto/traducción, **editar nota** (`api.updateHighlightNote`),
  **borrar** (`api.deleteHighlight`, ya existe en `useDocReader.removeHighlight`), y
  **ir a la posición** (EPUB: `rendition.display(cfi)`; PDF: scroll a la página del ancla).
- `useDocReader` ya expone `highlights`, `addHighlight`, `removeHighlight`; añadir
  `updateNote(id, note)` que llama a `api.updateHighlightNote` y actualiza el estado local.

**Sin cambios de esquema ni IPC** (reutiliza `update_highlight_note`, `delete_highlight`,
`list_highlights`). El "ir a posición" reaprovecha el posicionamiento del Item 1.

**Archivos que toca:**
- `src/features/reader/useDocReader.ts` (`updateNote` + sincronización de estado)
- `src/features/reader/DocReader.tsx` (panel de resaltados + acción "ir a")
- `src/features/reader/EpubView.tsx` / `PdfView.tsx` (API imperativa mínima `goTo(location)`
  expuesta vía `ref` o callback)
- `src/features/reader/docreader.css`

**Criterios de aceptación:**
- Abrir el panel muestra los resaltados del documento actual.
- Editar la nota persiste y se refleja también en `VocabularyView`.
- Borrar quita el resaltado del panel, del documento (overlay/annotation) y de la BD.
- "Ir a" reposiciona el lector en el resaltado.

**Tests:**
- Frontend (Vitest): `useDocReader` actualiza/borra del estado local tras llamar al `api`
  (mock). El "ir a" no se testea (depende del render real).

---

### Item 6 — TOC y búsqueda dentro del documento (P1)

**Problema:** no hay índice ni búsqueda interna.

**Enfoque simple:**
- **EPUB:** epub.js ya expone `book.navigation.toc` (TOC) y `book.spine` + `section.find(query)`
  para búsqueda. Mostrar TOC como lista navegable (`rendition.display(href)`); búsqueda
  recorriendo el spine y devolviendo resultados con su CFI para saltar.
- **PDF:** TOC vía `pdf.getOutline()` (puede ser null → estado "sin índice"); búsqueda
  recorriendo `page.getTextContent()` por página, acumulando coincidencias con su número de
  página (salto = scroll a esa página, que con el Item 2 fuerza el render).
- UI común: un panel "Índice / Buscar" en `DocReader` con pestañas; resultados clicables.
- La búsqueda PDF puede ser costosa en documentos enormes → **bajo demanda** (al pulsar
  buscar), con indicador de progreso simple; no indexar al abrir.

**Sin cambios de esquema ni IPC** (todo ocurre en el webview con pdf.js/epub.js).

**Archivos que toca:**
- `src/features/reader/EpubView.tsx` (exponer TOC + search vía callbacks/ref)
- `src/features/reader/PdfView.tsx` (exponer outline + search por páginas)
- `src/features/reader/DocReader.tsx` (panel TOC/búsqueda)
- nuevo helper opcional `src/features/reader/docSearch.ts` (lógica pura de matching)
- `src/features/reader/docreader.css`

**Criterios de aceptación:**
- EPUB y PDF con índice muestran el TOC y permiten saltar a una entrada.
- PDF/EPUB sin TOC muestran un estado vacío claro (no error).
- Buscar un término existente lista coincidencias y permite saltar a cada una.
- Buscar un término inexistente muestra "sin resultados".

**Tests:**
- Frontend (Vitest): helper `docSearch` (matching/normalización de texto, recorte de
  contexto del resultado) con entradas sintéticas. El recorrido real de pdf.js/epub.js no
  se testea en jsdom.

---

### Item 7 — Toasts / errores no bloqueantes (P1)

**Problema:** los errores se muestran inline y bloqueantes (p. ej. `library__error`,
mensajes inline en el lector).

**Enfoque simple (sin librería nueva):**
- Pequeño sistema de toasts propio con un store **Zustand** (ya es dependencia) y un
  componente `Toaster` montado una vez en `App.tsx`. API: `toast.success/error/info(msg)`.
- Migrar a toasts: errores/resultado de importación (`useLibrary`), errores de traducción
  no críticos, confirmaciones de guardado de resaltado.
- Los errores **críticos de carga** (no se pudo abrir el documento) siguen mostrándose
  inline en el `stage` (no son transitorios).

**Sin cambios de esquema ni IPC.**

**Archivos que toca:**
- nuevo `src/lib/toast-store.ts` (Zustand) y `src/components/Toaster.tsx` + CSS
- `src/App.tsx` (montar `Toaster`)
- `src/features/library/useLibrary.ts` / `LibraryView.tsx` (sustituir error inline donde aplique)
- `src/features/reader/DocReader.tsx` (avisos de guardado/traducción no crítica)

**Criterios de aceptación:**
- Importar con algún fallo → toast no bloqueante con el resumen; la app sigue usable.
- Guardar un resaltado → toast de confirmación efímero.
- Un error transitorio no deja un banner pegado en pantalla.

**Tests:**
- Frontend (Vitest): el `toast-store` agrega/expira toasts (con timers simulados).

---

### Item 8 — Estados vacíos y onboarding mínimo (P1)

**Problema:** la biblioteca vacía solo muestra un texto plano; no hay onboarding.

**Enfoque simple:**
- Mejorar el estado vacío de `ComicGrid` (ya existe el caso `comics.length === 0`) con un
  bloque de onboarding: icono, explicación corta y **CTA "Importar"** que dispare el flujo.
- Distinguir "biblioteca totalmente vacía" (primer uso) de "pocket/filtro sin resultados".
- Sin tour ni pasos múltiples (evitar sobreingeniería).

**Sin cambios de esquema ni IPC.**

**Archivos que toca:**
- `src/features/library/ComicGrid.tsx` (estados vacíos diferenciados + CTA)
- `src/features/library/LibraryView.tsx` (pasar handler de import al grid si hace falta)
- `src/features/library/library.css`

**Criterios de aceptación:**
- Sin libros: se ve el onboarding con CTA que abre el diálogo de importación.
- Pocket/filtro sin resultados: mensaje distinto ("no hay resultados con estos filtros").

**Tests:**
- Frontend (Vitest + Testing Library): `ComicGrid` renderiza el onboarding cuando
  `comics=[]` y el estado de "sin resultados" según contexto (prop/flag).

---

### Item 9 — Accesibilidad: teclado en la grilla + foco visible (P1)

**Problema:** la grilla no es navegable por teclado de forma clara y falta foco visible.

**Enfoque simple:**
- Hacer la grilla navegable con flechas (roving tabindex) y abrir con Enter/Espacio; el
  `card__cover` ya es un `<button>`, así que mayormente es orden de foco + manejo de teclas.
- Estilos `:focus-visible` consistentes en cards, botones y selects.
- Verbos accesibles: `aria-label` en controles icónicos; `role`/`aria` donde aporte.
- En el lector, asegurar foco visible y que Escape/flechas ya existentes sean consistentes.

**Sin cambios de esquema ni IPC.**

**Archivos que toca:**
- `src/features/library/ComicGrid.tsx` (navegación por teclado / roving tabindex)
- `src/features/library/library.css` y estilos globales (`:focus-visible`)
- `src/components/Icon.tsx` / botones icónicos (aria-labels donde falten)

**Criterios de aceptación:**
- Se puede recorrer la grilla con Tab/flechas y abrir un libro con Enter.
- El foco es visible en todos los controles interactivos.
- Lint de accesibilidad (si se añade regla) sin warnings; ESLint sigue en 0 warnings.

**Tests:**
- Frontend (Vitest + Testing Library): la grilla mueve el foco con flechas y dispara
  `onOpen` con Enter sobre la card enfocada.

---

## 4. Resumen de cambios de contrato (Rust ↔ TS)

| Cambio | Rust | TS |
|--------|------|----|
| Campo `last_location` en `Comic` | `models.rs` `last_location: Option<String>` | `types/index.ts` `lastLocation: string \| null` |
| Migración `comics.last_location` | `db.rs` `add_column_if_missing(... "last_location" "TEXT")` | — |
| Repo `update_doc_progress` | `repository.rs` | — |
| Comando `update_doc_progress` | `commands/documents.rs` + `lib.rs` | `api.ts` `updateDocProgress` |

Todo lo demás (traducción, resaltados, TOC/búsqueda, virtualización, toasts, onboarding,
a11y) se resuelve **sin** nuevos comandos ni cambios de esquema.

---

## 5. Dependencias

**No se añaden dependencias de runtime nuevas.** Toasts usan Zustand (ya presente);
virtualización usa `IntersectionObserver` nativo; TOC/búsqueda usan APIs de pdf.js/epubjs
ya instaladas.

Único cambio de dependencias: **resolución de seguridad de `epubjs`** (Item 4 / ADR-002),
vía `overrides` de `@xmldom/xmldom` o bump de `epubjs`, pendiente de confirmación.

---

## 6. Puertas de calidad (deben seguir verdes)

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
cargo fmt   --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test  --manifest-path src-tauri/Cargo.toml
npm audit   # objetivo Item 4
```

Reglas innegociables: ESLint **0 warnings**, `clippy -D warnings`, sin `any`, sin
`unwrap()` en rutas de usuario, SQL solo en `repository.rs`, migraciones solo en `db.rs`.

---

## 7. Puntos que requieren decisión del usuario antes de implementar

1. **Item 4 / ADR-002:** ¿se autoriza intentar el bump a `epubjs@0.4.2` si el `override`
   de `@xmldom/xmldom` no basta, asumiendo revalidación del render EPUB? ¿O se prefiere
   aceptar riesgo residual documentado en 1.0?
2. **Item 1:** confirmar la columna nueva `last_location` (alternativa: serializar todo en
   `last_page` no sirve para EPUB; la propuesta es la mínima).
3. **Item 7:** confirmar toasts caseros con Zustand (vs. no tocar y dejar inline). La
   propuesta evita dependencias nuevas.
