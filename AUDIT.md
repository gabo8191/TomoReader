# Auditoría — Tomo v0.1.0

Fecha: 2026-06-13 · Alcance: estructura, calidad, estabilidad y seguridad del MVP.

## 1. Resumen ejecutivo

Tomo es un lector de cómics/mangas CBR/CBZ de escritorio (Tauri 2 + React/TS).
El código está organizado por features (frontend) y por dominios con patrón
Repository (backend Rust). La lógica central de Rust **compila y pasa sus tests**;
el frontend pasa **typecheck, lint, formato y tests**.

| Área                      | Estado |
| ------------------------- | ------ |
| Frontend typecheck (`tsc`)| ✅ sin errores |
| Frontend lint (ESLint)    | ✅ 0 warnings |
| Frontend formato (Prettier)| ✅ |
| Frontend tests (Vitest)   | ✅ 3/3 |
| Rust formato (rustfmt)    | ✅ |
| Rust clippy (crate completo, `-D warnings`) | ✅ sin lints |
| Rust tests               | ✅ 4/4 (sorting, mime) |
| Build completo de Tauri   | ✅ compila (`webkit2gtk-4.1` instalado); frontend empaquetado a `dist/` |

> Verificado en Fedora/Nobara tras instalar `webkit2gtk4.1-devel` y el grupo
> `c-development`. El crate de Tauri compila por completo, incluido el uso real
> de la API de `unrar`/`zip`/`image`/`rusqlite`.

## 2. Verificación reproducible

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
# Tras instalar webkit2gtk (ver README):
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test  --manifest-path src-tauri/Cargo.toml
npm run tauri:dev
```

## 3. Seguridad

| Punto | Evaluación |
| ----- | ---------- |
| **CSP** | Restrictiva: `default-src 'self'`, `img-src` limitado a `self`/`data:`/`asset:`. Sin `unsafe-eval`. |
| **Permisos Tauri** | Capabilities mínimas: `core:default` + `dialog:default`. Sin acceso a `fs`/`shell` arbitrario desde el frontend. |
| **Rutas de archivo** | La apertura se hace vía diálogo nativo del SO (el usuario elige). El backend valida formato por extensión y maneja errores por archivo. |
| **Path traversal (extracción CBR)** | Las páginas se escriben con **nombres regenerados** (`00000.jpg`…), nunca con la ruta interna del archivo → no hay zip-slip. |
| **SQL injection** | Todo el SQL usa **consultas parametrizadas** (`params!`). Sin concatenación de strings. |
| **Integridad referencial** | `PRAGMA foreign_keys=ON`; borrar un pocket hace `SET NULL` en sus cómics (no se pierden datos). |
| **Secretos** | La app no maneja credenciales ni red. `.env` ignorado por git. |
| **Manejo de errores** | `AppError` tipado con `thiserror`; sin `unwrap()` en rutas de comando (los locks usan `with_db`/`with_sessions` con error explícito). |

### Vulnerabilidades de dependencias (npm audit)

- **6 advisories (high)**, todas originadas en **`esbuild`** (cadena de
  desarrollo de Vite/Vitest). Afectan al **servidor de desarrollo**, que escucha
  solo en `localhost`. **No forman parte del bundle de producción** que empaqueta
  Tauri. Riesgo real bajo.
- Remediación opcional: subir a `vite@8` (cambio mayor) cuando convenga.
- `cargo audit` sobre las dependencias Rust: pendiente de ejecutar en la máquina
  con toolchain completa (`cargo install cargo-audit && cargo audit`).

## 4. Estabilidad y rendimiento

- **Lectura RAR**: el acceso aleatorio en RAR es O(n); por eso se **extrae una vez
  a caché** al abrir y se libera con `Drop` al cerrar la sesión. CBZ usa acceso
  aleatorio directo (rápido).
- **Caché + prefetch** de páginas en el lector para una navegación fluida.
- **Progreso debounced** (600 ms) para no saturar SQLite.
- **Importación resiliente**: un archivo corrupto no aborta el lote completo.
- **SQLite en modo WAL** para mejor concurrencia lectura/escritura.

## 5. Limitaciones conocidas / deuda técnica

1. **Páginas vía base64 IPC**: simple y robusto, pero para páginas muy grandes el
   protocolo `asset:` de Tauri sería más eficiente (mejora futura).
2. **CB7/PDF** no soportados (decisión de alcance: CBR + CBZ).
3. **Doble página** existe en el store pero aún no se renderiza en el lector.
4. **Tests de integración Rust** (abrir un CBZ real) pendientes; ahora solo hay
   tests unitarios de `sorting` y `util`.
5. **Ejecución end-to-end** (`tauri dev` abriendo la ventana) no ejercitada en
   este entorno headless; el código compila y los comandos están registrados.

## 6. Recomendaciones priorizadas

1. Instalar `webkit2gtk` y validar `cargo clippy -D warnings` + `tauri dev`.
2. Añadir `cargo-audit` al pipeline de CI (job backend).
3. Tests de integración: fixture `.cbz`/`.cbr` mínimo en `src-tauri/tests/`.
4. Configurar **Husky + lint-staged** para validar antes de cada commit.
5. Migrar el render de páginas al protocolo `asset:` si se notan archivos pesados.
