# STYLES.md — Convenciones visuales de TomoReader

Documento descriptivo del sistema visual **existente** en el código fuente.
No define un sistema nuevo: describe lo que ya está implementado para que
los componentes nuevos (toasts, estados vacíos, panel TOC, resaltados) sean
coherentes con lo existente.

---

## 1. Paleta de colores (tokens CSS en `:root` / `[data-theme]`)

Los temas se activan con `<html data-theme="...">`. El tema por defecto al
instalar es **sepia** (ver `settings-store.ts`).

| Token             | dark        | oled        | sepia       | light       | Uso                              |
|-------------------|-------------|-------------|-------------|-------------|----------------------------------|
| `--bg`            | `#1a1730`   | `#000000`   | `#2a2620`   | `#f4f1ea`   | Fondo principal                  |
| `--bg-elevated`   | `#241f3d`   | `#0c0c0c`   | `#332e26`   | `#ffffff`   | Cabeceras, paneles flotantes     |
| `--bg-reader`     | `#14121f`   | `#000000`   | `#211d18`   | `#e8e3d8`   | Fondo del stage del lector       |
| `--surface`       | `#2b2545`   | `#141414`   | `#3b352b`   | `#ffffff`   | Cards, inputs, chips             |
| `--text`          | `#ece8f5`   | `#e6e6e6`   | `#f0e6d2`   | `#2b2545`   | Texto principal                  |
| `--text-muted`    | `#a39fb8`   | `#8a8a8a`   | `#b8ac93`   | `#6b6580`   | Texto secundario, hints          |
| `--border`        | `#3a3358`   | `#242424`   | `#4a4336`   | `#ddd6c8`   | Bordes de componentes            |
| `--accent`        | `#f5a623`   | `#f5a623`   | `#e8743b`   | `#e8743b`   | CTA principal, progreso, badges  |

### Colores no tokenizados (usos puntuales)
- Error inline lector: `#ff9b9b` (texto)
- Error banner biblioteca: fondo `#5a2a2a`, texto `#ffd9d9`
- Overlay resaltado PDF: `rgba(245,166,35, 0.4)` → `opacity: 0.4` + color del resaltado
- Resaltado EPUB: `fill` controlado por el campo `color` del `Highlight` (hex)
- Badge de formato y `btn--primary`: texto `#1a1730` sobre fondo `--accent` (garantiza contraste)

---

## 2. Tipografía

**Fuente:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
(variable `--font-sans`, aplicada en `body`). Sin fuentes remotas ni Google Fonts.

| Uso                     | Tamaño  | Peso  | Color          |
|-------------------------|---------|-------|----------------|
| Título de la biblioteca | 22px    | 700   | `--text`       |
| Título de card          | 14px    | 600   | `--text`       |
| Botones, chips          | 12–14px | 600   | según variante |
| Texto secundario, hints | 12–13px | 400   | `--text-muted` |
| Barra lookup (fuente)   | 15px    | 600   | `--text`       |
| Barra lookup (traducción)| 14px   | 400   | `--accent`     |
| Badge de formato        | 10px    | 700   | `#1a1730`      |

---

## 3. Espaciado y grid

- **Radio de borde base:** `--radius: 12px` (cards, paneles, overlays principales).
  Controles internos (inputs, select, botones pequeños): 8px. Badge: 6px.
- **Transición base:** `--transition: 160ms ease`.
- **Grid de biblioteca:** `repeat(auto-fill, minmax(170px, 1fr))`, gap `24px`,
  padding horizontal `28px`.
- **Sidebar:** ancho fijo `240px`, padding `16px 12px`.
- **Topbar del lector:** padding `10px 16px`, gap `12px` entre elementos.
- **Lookup bar:** padding `14px 20px`, gap `16px` entre texto y acciones.
- **Gap estándar entre botones:** `8–10px`.

---

## 4. Breakpoints responsive

La app es de **escritorio exclusivamente** (Tauri 2). No hay breakpoints responsive.
El diseño asume viewport de al menos 800 × 600 px. La sidebar tiene ancho fijo
y el contenido principal ocupa el resto con `flex: 1`.

---

## 5. Componentes base

### `.btn`
Botón con borde, fondo `--surface`, border `--border`, radio `--radius`, texto 14px.
- `.btn--primary`: fondo `--accent`, borde `--accent`, texto `#1a1730`, peso 600.
- `.btn--ghost`: fondo y borde transparentes.
- Hover: `.btn` → `--bg-elevated`; `.btn--primary` → `filter: brightness(1.08)`.

### `.iconbtn`
38×38 px, radio 10px, fondo `--surface`, borde `--border`. Variante `.iconbtn--active`:
fondo `--accent`, borde `--accent`, texto `#1a1730`.

### `.chip`
Pastilla de filtro: padding `5px 12px`, radio `20px`, texto 12px peso 600, color
`--text-muted`. Activo (`.chip--active`): fondo `--accent`, borde `--accent`, texto `#1a1730`.

### Inputs y selects
Padding `6–8px 10px`, radio `8px`, borde `--border`, fondo `--surface` o `--bg-reader`,
color `--text`. Sin outline nativo (no hay aún `:focus-visible` explícito — se añade en Item 9).

### `.card`
Flex column, gap 8px. Cover: aspect-ratio 2/3, radio `--radius`, overflow hidden,
borde `--border`. Hover: `translateY(-3px)`. Badge top-left: radio 6px, fondo `--accent`.
Barra de progreso inferior: 4px, color `--accent`.

### Estados vacíos (`.grid__state`)
Flex column centrado, gap 6px, color `--text-muted`. Incluye párrafo de hint (13px).
**Se mejora en Item 8** con icono y CTA.

### Mensajes del lector (`.docreader__msg`)
`margin: auto`, 15px, `--text-muted`. Variante error: `#ff9b9b`.

### Errores inline de biblioteca (`.library__error`)
Flex space-between, fondo `#5a2a2a`, texto `#ffd9d9`, radio `--radius`, margin `12px 28px 0`.

---

## 6. Iconografía

SVG inline 24×24, trazo `currentColor`, `strokeWidth=2`, `strokeLinecap=round`.
Declarados en `src/components/Icon.tsx`. Iconos disponibles:
`back`, `close`, `settings`, `brightness`, `warmth`, `fit-width`, `fit-height`,
`fit-original`, `theme`, `plus`, `folder`, `trash`, `chevron-left`, `chevron-right`, `book`.

Todos llevan `aria-hidden="true"` porque se usan dentro de botones con label o texto visible.
Nuevos iconos deben seguir el mismo trazo/tamaño para coherencia visual.

---

## 7. Animaciones permitidas

- `transition: background 160ms ease` → hovers de botones y pockets.
- `transform: translateY(-3px)` → hover de cards de la grilla.
- Sin animaciones de entrada/salida explícitas definidas todavía (los toasts nuevos
  usarán una entrada simple con `opacity + translateY` coherente con `--transition`).

---

## 8. Tono visual

Oscuro por defecto (sepia al instalar), minimalista, sin decoración superflua.
Paleta cálida (ocre/naranja en `--accent`) para reducir fatiga visual.
Sin gradientes en componentes de interfaz (solo el canvas del PDF/EPUB).

---

## 9. Dark mode

**Siempre activo.** Los cuatro temas (`dark`, `oled`, `sepia`, `light`) son todos
variantes de paletas oscuras o neutras cálidas. No hay un modo light convencional
de alta saturación. El tema `light` es el más claro pero sigue siendo de baja
saturación. El fondo blanco del EPUB (`docreader__surface`) es del renderizador
de epub.js, no de la UI de Tomo.

---

## 10. Patrones de componentes nuevos (guía para Items 7, 8, 9)

### Toasts (Item 7)
- Posición: esquina inferior derecha, apilados verticalmente, z-index alto (≥ 50).
- Variantes: `success` (verde `#3a7d44`), `error` (rojo `#8b2a2a` fondo / `#ffd9d9` texto),
  `info` (fondo `--surface`, borde `--border`).
- Animación: entrada `opacity 0→1 + translateY(8px→0)` en `160ms ease`.
- Auto-cierre: 4 segundos (configurable por variante).
- Sin bloquear contenido subyacente.

### Estados vacíos mejorados (Item 8)
- Icono SVG grande (48px), centrado.
- Párrafo de explicación en `--text-muted`, 14px.
- CTA: botón `.btn--primary` que dispara la acción relevante.
- Sin tour ni pasos múltiples.

### Focus visible (Item 9)
- `:focus-visible` outline: `2px solid var(--accent)`, offset `2px`.
- No afecta a `:focus` (solo al foco por teclado).
