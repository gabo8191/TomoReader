<div align="center">
  <img src="src-tauri/icons/logo.svg" width="96" height="96" alt="TomoReader" />
  <h1>TomoReader</h1>
  <p>Lector de cómics y mangas <strong>CBR/CBZ</strong> de escritorio, cómodo para la vista.</p>
</div>

---

## ✨ Características

- 📚 **Pockets (carpetas)** para organizar tus cómics y mangas.
- 📖 Lectura de archivos **CBR** (RAR) y **CBZ** (ZIP).
- 🌙 **Temas de lectura cómoda**: Sepia, Oscuro, OLED puro y Claro.
- 🔆 **Control de brillo** y **filtro de calidez** (reduce la luz azul) para sesiones largas.
- ↔️ **Dirección de lectura** configurable (LTR para cómic, RTL para manga).
- 🖼️ Ajuste de página por **alto, ancho u original**.
- ⌨️ **Navegación por teclado** (flechas, espacio, Inicio/Fin, Esc) y zonas de clic.
- 💾 **Progreso de lectura** guardado automáticamente por cómic.
- ⚡ Caché de páginas en memoria con **prefetch** de la siguiente página.

## 🧱 Stack

| Capa      | Tecnología                                  |
| --------- | ------------------------------------------- |
| Núcleo    | **Rust** + **Tauri 2**                      |
| UI        | **React 18** + **TypeScript** + **Vite**    |
| Estado    | **Zustand** (preferencias persistidas)      |
| Datos     | **SQLite** (`rusqlite`, bundled)            |
| Archivos  | `zip` (CBZ) + `unrar` (CBR) + `image`       |

## 📋 Requisitos

- **Node.js** ≥ 18 y **npm**
- **Rust** ≥ 1.77 (`rustup`)
- Dependencias del sistema de Tauri (Linux):

```bash
# Fedora / Nobara
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel
sudo dnf group install "c-development"

# Debian / Ubuntu
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## 🚀 Puesta en marcha

```bash
npm install          # dependencias del frontend
npm run tauri:dev    # arranca la app en modo desarrollo (hot-reload)
```

## 📦 Build de producción

```bash
npm run tauri:build  # genera el ejecutable + instaladores en src-tauri/target/release
```

## 🧪 Calidad

```bash
# Frontend
npm run lint          # ESLint (0 warnings permitidos)
npm run format:check  # Prettier
npm run typecheck     # TypeScript estricto
npm test              # Vitest

# Backend
cargo fmt    --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test   --manifest-path src-tauri/Cargo.toml
```

## 🏛️ Arquitectura

```
src/                      # Frontend React (por features)
├── features/
│   ├── library/          # Pockets + grid de cómics
│   ├── reader/           # Lector (hook + vista)
│   └── settings/         # Panel de preferencias
├── lib/                  # api (invoke) + store de ajustes
└── types/                # Contrato compartido con Rust

src-tauri/src/            # Backend Rust
├── archive/              # Lectura CBR/CBZ + ordenación natural
├── library/              # models · db (migraciones) · repository (SQL)
├── commands/             # Comandos Tauri expuestos al frontend
├── state.rs · error.rs · util.rs
└── lib.rs · main.rs
```

### Comandos expuestos (IPC)

| Comando            | Descripción                                  |
| ------------------ | -------------------------------------------- |
| `list_pockets`     | Lista los pockets con su nº de cómics        |
| `create_pocket`    | Crea un pocket (nombre + color)              |
| `rename_pocket`    | Renombra un pocket                           |
| `delete_pocket`    | Elimina un pocket (los cómics pasan a Todos) |
| `list_comics`      | Lista cómics (opcionalmente por pocket)      |
| `import_comics`    | Importa archivos CBR/CBZ (resiliente)        |
| `move_comic`       | Mueve un cómic a otro pocket                 |
| `delete_comic`     | Quita un cómic de la biblioteca              |
| `open_comic`       | Abre una sesión de lectura                   |
| `get_page`         | Devuelve una página como data URL            |
| `update_progress`  | Guarda la última página leída                |

## 📄 Licencia

MIT — © Gabriel Castillo ([@gabo8191](https://github.com/gabo8191))

> El soporte CBR usa la librería `unrar`. UnRAR es software gratuito con una
> licencia propia que **prohíbe recrear el algoritmo de compresión RAR**; su uso
> para descompresión (como aquí) está permitido. Revísala si vas a distribuir.
