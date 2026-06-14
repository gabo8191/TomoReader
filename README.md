<div align="center">
  <img src="src-tauri/icons/logo.svg" width="96" height="96" alt="TomoReader" />
  <h1>TomoReader</h1>
  <p><strong>Lector de cómics y mangas (CBR/CBZ) de escritorio, cómodo para la vista.</strong></p>

  <p>
    <a href="https://github.com/gabo8191/TomoReader/actions/workflows/ci.yml">
      <img src="https://github.com/gabo8191/TomoReader/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
    </a>
    <img src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18" />
    <img src="https://img.shields.io/badge/Rust-1.77+-000000?logo=rust&logoColor=white" alt="Rust" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" />
  </p>
</div>

---

**TomoReader** es una aplicación de escritorio ligera (Rust + Tauri) para leer cómics y
mangas en formato **CBR** y **CBZ**. Organiza tu colección en *pockets*, recuerda por
dónde ibas y ofrece modos de lectura pensados para sesiones largas sin cansar la vista.

> 🧪 Proyecto open source. ¿Te resulta útil o quieres mejorarlo? Las
> [contribuciones](#-contribuir) son bienvenidas.

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

## 🖼️ Capturas

> _Próximamente._ Si pruebas la app, ¡comparte tus capturas en un PR o issue! 🙌

<!--
<div align="center">
  <img src="docs/screenshot-library.png" width="45%" alt="Biblioteca" />
  <img src="docs/screenshot-reader.png" width="45%" alt="Lector" />
</div>
-->

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

> En macOS y Windows basta con tener Rust, Node y las herramientas de compilación
> nativas (Xcode Command Line Tools / Build Tools de Visual Studio). Consulta los
> [requisitos de Tauri](https://tauri.app/start/prerequisites/) para tu plataforma.

## 🚀 Puesta en marcha

```bash
git clone git@github.com:gabo8191/TomoReader.git
cd TomoReader

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

La CI ([GitHub Actions](.github/workflows/ci.yml)) ejecuta estos mismos pasos en cada
push y pull request. **Husky + lint-staged** validan formato, lint y tipos antes de
cada commit.

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

## 🗺️ Roadmap

- [ ] Render de **doble página** (ya modelado en el store).
- [ ] Migrar el render de páginas al protocolo `asset:` para archivos pesados.
- [ ] Tests de integración con fixtures `.cbz` / `.cbr` reales.
- [ ] Soporte de formatos adicionales (CB7 / PDF) — _en evaluación_.
- [ ] `cargo-audit` en el pipeline de CI.

¿Tienes una idea que no está aquí? Abre un [issue](https://github.com/gabo8191/TomoReader/issues).

## 🤝 Contribuir

1. Haz un **fork** y crea una rama: `git checkout -b feat/mi-mejora`.
2. Asegúrate de que pasan lint, formato, tipos y tests (ver [Calidad](#-calidad)).
3. Usa commits convencionales: `feat(scope): …`, `fix(scope): …`, `docs: …`.
4. Abre un **Pull Request** describiendo el cambio.

Para cambios grandes, abre primero un issue para discutir el enfoque.

## 📄 Licencia

MIT — © Gabriel Castillo ([@gabo8191](https://github.com/gabo8191)). Consulta [LICENSE](LICENSE).

> El soporte CBR usa la librería `unrar`. UnRAR es software gratuito con una
> licencia propia que **prohíbe recrear el algoritmo de compresión RAR**; su uso
> para descompresión (como aquí) está permitido. Revísala si vas a distribuir.
