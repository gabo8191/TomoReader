# ADR — Architecture Decision Records (TomoReader)

Registro de decisiones de arquitectura y de producto relevantes. Cada ADR documenta el
**contexto**, la **decisión**, sus **consecuencias** y el **origen** de la decisión
(`[INSTRUCCIÓN del usuario]` o `[SUPOSICIÓN del agente]`).

## Plantilla

```markdown
## ADR-NNN — Título

- Estado: Propuesto | Aceptado | Rechazado | Sustituido por ADR-XXX
- Fecha: AAAA-MM-DD
- Origen: [INSTRUCCIÓN del usuario] | [SUPOSICIÓN del agente]

### Contexto
Qué problema o situación motiva la decisión.

### Decisión
Qué se decide hacer.

### Consecuencias
Efectos positivos/negativos, riesgos y trabajo derivado.
```

---

## ADR-001 — Alcance de finalización a 1.0: cerrar P0 + P1

- Estado: Aceptado
- Fecha: 2026-06-23
- Origen: [INSTRUCCIÓN del usuario]

### Contexto
TomoReader está en `0.2.0`. Compila y pasa todas las puertas de calidad (typecheck,
ESLint 0 warnings, Vitest, rustfmt, clippy `-D warnings`, cargo test). El `ROADMAP.md`
define pendientes P0 (estabilidad/calidad), P1 (funcionalidad esperable) y P2
(distribución/mantenimiento). Se necesita acotar qué entra en la 1.0.

### Decisión
La 1.0 cierra **únicamente P0 + P1** del ROADMAP:
- **P0:** progreso de lectura en documentos; render PDF perezoso por viewport; robustez
  de traducción (error UI + reintento + caché en memoria); decisión sobre vulnerabilidades
  de `epubjs`.
- **P1:** gestión de resaltados desde el lector; TOC + búsqueda en documento; toasts no
  bloqueantes; estados vacíos/onboarding; accesibilidad por teclado + foco visible.

Se respetan estrictamente las convenciones existentes (patrón Repository, `AppError`,
sin `unwrap()` en rutas de usuario, sin `any`, tipos sincronizados, migraciones solo en
`db.rs`). **No** se añaden frameworks ni se migran patrones. Se prefieren soluciones
simples. P2 (Windows/macOS, updater, ampliación de tests/CI) queda **fuera** de 1.0.

### Consecuencias
- Alcance claro y verificable; el detalle vive en `SPEC.md`.
- Único cambio de esquema previsto: columna `comics.last_location` (migración idempotente).
- Único cambio de dependencias previsto: resolución de seguridad de `epubjs` (ver ADR-002).
- P2 deberá planificarse en una iteración posterior (no bloquea 1.0).

---

## ADR-003 — Semántica del comando `update_doc_progress`

- Estado: Aceptado
- Fecha: 2026-06-23
- Origen: [INSTRUCCIÓN del usuario]

### Contexto

El SPEC define un único comando `update_doc_progress` para PDF (posición = número de
página) y EPUB (posición = CFI string). Se debatió si usar dos comandos separados o uno
con parámetros opcionales.

### Decisión

Un solo comando con `last_page: Option<i64>` y `last_location: Option<String>`, ambos
opcionales en la llamada. El backend actualiza **solo los campos provistos** (SQL
`UPDATE` independiente por campo), de modo que una llamada con solo `last_page` no borra
el CFI guardado, y viceversa. Se rechaza explícitamente la llamada si ambos son `None`
o string vacío (error `UnsupportedFormat` con mensaje descriptivo).

Esto evita añadir un segundo comando Tauri y mantiene el contrato mínimo descrito en el
SPEC, sin perder la independencia entre ambos campos.

### Consecuencias

- El frontend puede llamar al comando con solo el campo relevante al tipo de documento.
- No se sobreescribe progreso existente por pasar `null` en el campo irrelevante.
- La validación en el handler evita persistir llamadas vacías sin lógica en el repositorio.

---

## ADR-002 — Tratamiento de las vulnerabilidades de `epubjs`

- Estado: Aceptado
- Fecha: 2026-06-23
- Origen: [INSTRUCCIÓN del usuario]

### Contexto
`npm audit` (2026-06) reportaba **5 advisories high** originados en la dependencia
transitiva **`@xmldom/xmldom <= 0.8.12`** (XML injection / DoS / comment/PI injection),
arrastrada por **`epubjs@0.3.93`**. El `audit fix --force` proponía `epubjs@0.4.2`
(breaking change). El AUDIT.md original los atribuía erróneamente a `esbuild`; corregido.

### Decisión
Se aplicó la **opción 1 (override mínimo)**: campo
`"overrides": { "@xmldom/xmldom": ">=0.9.0" }` en `package.json` + `npm install`.

Resultado inmediato: `npm audit` → **0 vulnerabilidades**. `epubjs@0.3.93` permanece
sin cambios; su API (display, `selected`, `annotations.highlight`, `relocated`) sigue
intacta. No fue necesario subir a `epubjs@0.4.2`.

### Consecuencias
- `@xmldom/xmldom` se resuelve a `>=0.9.0` (parcheado).
- `npm audit` en CI reporta 0 high desde la 1.0-rc.
- Si en el futuro `epubjs` sube a `0.4.x`, habrá que revalidar `EpubView.tsx`.

---

## ADR-004 — Sistema de toasts sin dependencias nuevas

- Estado: Aceptado
- Fecha: 2026-06-23
- Origen: [INSTRUCCIÓN del usuario]

### Contexto
El SPEC (Item 7) requería avisos no bloqueantes sin añadir librerías nuevas. Zustand
ya era dependencia del proyecto.

### Decisión
Store Zustand en `src/lib/toast-store.ts` + componente `Toaster.tsx`. API pública
`toast.success/error/info(msg, duration?)`. Auto-cierre por `setTimeout`. Montado
una vez en `App.tsx` como portal fijo (esquina inferior derecha, z-index 50).

### Consecuencias
- 0 dependencias nuevas de runtime.
- Testeable con `vi.useFakeTimers` (6 tests unitarios).
- Si se requieren toasts con progreso o acciones complejas, Sonner (ya en la lista
  de librerías aprobadas) puede adoptarse sin romper el contrato `toast.*`.

---

## ADR-005 — Render PDF perezoso con IntersectionObserver nativo

- Estado: Aceptado
- Fecha: 2026-06-23
- Origen: [INSTRUCCIÓN del usuario]

### Contexto
`PdfView` renderizaba todas las páginas en un bucle al abrir. En PDFs de 200+ páginas
era lento y consumía mucha memoria GPU.

### Decisión
Virtualización con `IntersectionObserver` nativo (sin librería nueva). Estrategia:
1. Crear todos los contenedores `.pdfpage` con `width/height` reservado (evita CLS).
2. Observer con `rootMargin='100%'` renderiza canvas + textLayer al entrar en zona visible.
3. Al salir, se eliminan canvas/textLayer; el contenedor conserva el espacio reservado.
4. Resaltados se reaplican en cada `renderPage` al re-entrar en viewport.
5. Función pura `nearestPageInViewport` extraída a `pdfUtils.ts` (testeable sin DOM).

### Consecuencias
- 0 dependencias nuevas (`IntersectionObserver` es API nativa Web).
- La portada (página 1) se rasteriza al primer renderizado; `onCover` funciona igual.
- 7 tests unitarios en `pdfUtils.test.ts`.
