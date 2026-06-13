use std::fs;
use std::path::{Path, PathBuf};

use unrar::Archive;

use crate::error::{AppError, Result};

use super::{is_image, sorting::natural_cmp};

/// Convierte cualquier error de la librería unrar en `AppError::Rar`.
fn rar_err<E: std::fmt::Display>(e: E) -> AppError {
    AppError::Rar(e.to_string())
}

/// Lista los nombres de las entradas de imagen en orden natural de lectura.
pub fn list_pages(path: &Path) -> Result<Vec<String>> {
    let archive = Archive::new(path).open_for_listing().map_err(rar_err)?;

    let mut names = Vec::new();
    for entry in archive {
        let entry = entry.map_err(rar_err)?;
        let name = entry.filename.to_string_lossy().to_string();
        if entry.is_file() && is_image(&name) {
            names.push(name);
        }
    }
    names.sort_by(|a, b| natural_cmp(a, b));
    Ok(names)
}

/// Extrae todas las imágenes a `dest` y devuelve sus rutas en orden de lectura.
///
/// El acceso aleatorio a entradas RAR es costoso (requiere recorrer el archivo
/// desde el inicio), por eso extraemos una sola vez y luego leemos del disco.
pub fn extract_all(path: &Path, dest: &Path) -> Result<Vec<PathBuf>> {
    fs::create_dir_all(dest)?;

    // (nombre_original, ruta_extraida) para reordenar al final.
    let mut extracted: Vec<(String, PathBuf)> = Vec::new();
    let mut counter: usize = 0;

    let mut archive = Archive::new(path).open_for_processing().map_err(rar_err)?;
    while let Some(header) = archive.read_header().map_err(rar_err)? {
        let entry = header.entry();
        let name = entry.filename.to_string_lossy().to_string();

        if entry.is_file() && is_image(&name) {
            let ext = Path::new(&name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("img");
            let out = dest.join(format!("{counter:05}.{ext}"));

            let (data, rest) = header.read().map_err(rar_err)?;
            fs::write(&out, data)?;
            extracted.push((name, out));
            counter += 1;
            archive = rest;
        } else {
            archive = header.skip().map_err(rar_err)?;
        }
    }

    // El orden físico dentro del RAR no siempre es el de lectura.
    extracted.sort_by(|a, b| natural_cmp(&a.0, &b.0));
    Ok(extracted.into_iter().map(|(_, path)| path).collect())
}

/// Extrae únicamente la primera imagen (para la portada) sin volcar todo.
pub fn read_first_image(path: &Path) -> Result<Option<Vec<u8>>> {
    let pages = list_pages(path)?;
    let Some(first) = pages.first().cloned() else {
        return Ok(None);
    };

    let mut archive = Archive::new(path).open_for_processing().map_err(rar_err)?;
    while let Some(header) = archive.read_header().map_err(rar_err)? {
        let entry = header.entry();
        let name = entry.filename.to_string_lossy().to_string();
        if entry.is_file() && name == first {
            let (data, _rest) = header.read().map_err(rar_err)?;
            return Ok(Some(data));
        }
        archive = header.skip().map_err(rar_err)?;
    }
    Ok(None)
}
