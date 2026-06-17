//! Lectura de archivos de cómic CBR (RAR) y CBZ (ZIP).
//!
//! Expone una abstracción `OpenedComic` que oculta las diferencias entre
//! formatos al resto de la aplicación.

mod cbr;
mod cbz;
mod epub;
mod sorting;

use std::path::{Path, PathBuf};

use crate::error::{AppError, Result};

/// Extensiones de imagen reconocidas dentro de un archivo de cómic.
const IMAGE_EXTS: [&str; 6] = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

/// Determina si un nombre de entrada corresponde a una imagen de página.
pub(crate) fn is_image(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    // Las carpetas de metadatos de macOS no son páginas reales.
    if lower.contains("__macosx") {
        return false;
    }
    Path::new(&lower)
        .extension()
        .and_then(|e| e.to_str())
        .map(|ext| IMAGE_EXTS.contains(&ext))
        .unwrap_or(false)
}

/// Formato soportado, derivado de la extensión del archivo.
///
/// Los formatos de cómic (`Cbz`/`Cbr`) son basados en imágenes y se leen con el
/// pipeline de páginas. Los de documento (`Pdf`/`Epub`) se renderizan en el
/// webview (pdf.js/epub.js) y no pasan por ese pipeline.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Cbz,
    Cbr,
    Pdf,
    Epub,
}

impl Format {
    pub fn from_path(path: &Path) -> Result<Self> {
        match path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref()
        {
            Some("cbz") | Some("zip") => Ok(Format::Cbz),
            Some("cbr") | Some("rar") => Ok(Format::Cbr),
            Some("pdf") => Ok(Format::Pdf),
            Some("epub") => Ok(Format::Epub),
            other => Err(AppError::UnsupportedFormat(
                other.unwrap_or("desconocido").to_string(),
            )),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Format::Cbz => "cbz",
            Format::Cbr => "cbr",
            Format::Pdf => "pdf",
            Format::Epub => "epub",
        }
    }

    /// Indica si el formato es un documento de texto (PDF/EPUB) que se renderiza
    /// en el webview en vez de con el pipeline de imágenes.
    pub fn is_document(self) -> bool {
        matches!(self, Format::Pdf | Format::Epub)
    }
}

/// Metadatos extraídos al importar un cómic (sin abrir una sesión completa).
pub struct ComicMetadata {
    pub format: Format,
    pub page_count: usize,
    /// Bytes crudos de la primera página, para generar la miniatura de portada.
    pub cover: Option<Vec<u8>>,
}

/// Lee el número de páginas y la portada de un archivo sin extraerlo entero.
pub fn read_metadata(path: &Path) -> Result<ComicMetadata> {
    let format = Format::from_path(path)?;
    match format {
        // Los documentos (PDF/EPUB) los pagina y renderiza el frontend; aquí solo
        // validamos que el archivo exista y, para EPUB, extraemos la portada del ZIP.
        Format::Pdf | Format::Epub => {
            if !path.is_file() {
                return Err(AppError::NotFound(format!("{path:?}")));
            }
            // La portada de PDF se genera en el frontend (set_comic_cover); EPUB se
            // lee aquí. Un fallo de portada no debe abortar la importación.
            let cover = match format {
                Format::Epub => epub::read_cover(path).ok().flatten(),
                _ => None,
            };
            Ok(ComicMetadata {
                format,
                page_count: 0,
                cover,
            })
        }
        Format::Cbz => {
            let pages = cbz::list_pages(path)?;
            let cover = pages
                .first()
                .map(|name| cbz::read_entry(path, name))
                .transpose()?;
            Ok(ComicMetadata {
                format,
                page_count: pages.len(),
                cover,
            })
        }
        Format::Cbr => {
            let pages = cbr::list_pages(path)?;
            let cover = cbr::read_first_image(path)?;
            Ok(ComicMetadata {
                format,
                page_count: pages.len(),
                cover,
            })
        }
    }
}

/// Un cómic abierto y listo para lectura página a página.
pub enum OpenedComic {
    /// CBZ: acceso aleatorio directo por nombre de entrada (rápido).
    Zip { path: PathBuf, entries: Vec<String> },
    /// CBR: páginas ya extraídas a disco (RAR no admite acceso aleatorio barato).
    Rar {
        temp_dir: PathBuf,
        pages: Vec<PathBuf>,
    },
}

impl OpenedComic {
    /// Abre el cómic. Para CBR, extrae las páginas a `<cache_dir>/comic-<id>`.
    pub fn open(path: &Path, cache_dir: &Path, comic_id: i64) -> Result<Self> {
        match Format::from_path(path)? {
            // PDF/EPUB no usan el pipeline de imágenes; se sirven con read_document.
            Format::Pdf | Format::Epub => Err(AppError::UnsupportedFormat(
                "los documentos PDF/EPUB no se abren como cómic de imágenes".into(),
            )),
            Format::Cbz => {
                let entries = cbz::list_pages(path)?;
                Ok(OpenedComic::Zip {
                    path: path.to_path_buf(),
                    entries,
                })
            }
            Format::Cbr => {
                let temp_dir = cache_dir.join(format!("comic-{comic_id}"));
                let pages = cbr::extract_all(path, &temp_dir)?;
                Ok(OpenedComic::Rar { temp_dir, pages })
            }
        }
    }

    pub fn page_count(&self) -> usize {
        match self {
            OpenedComic::Zip { entries, .. } => entries.len(),
            OpenedComic::Rar { pages, .. } => pages.len(),
        }
    }

    /// Devuelve los bytes crudos (sin recodificar) de la página `index`.
    pub fn read_page(&self, index: usize) -> Result<Vec<u8>> {
        match self {
            OpenedComic::Zip { path, entries } => {
                let name = entries
                    .get(index)
                    .ok_or_else(|| AppError::NotFound(format!("página {index}")))?;
                cbz::read_entry(path, name)
            }
            OpenedComic::Rar { pages, .. } => {
                let file = pages
                    .get(index)
                    .ok_or_else(|| AppError::NotFound(format!("página {index}")))?;
                Ok(std::fs::read(file)?)
            }
        }
    }
}

impl Drop for OpenedComic {
    /// Limpia las páginas temporales extraídas de un CBR al cerrar la sesión.
    fn drop(&mut self) {
        if let OpenedComic::Rar { temp_dir, .. } = self {
            let _ = std::fs::remove_dir_all(temp_dir);
        }
    }
}
