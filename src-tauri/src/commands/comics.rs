use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::State;

use crate::archive;
use crate::error::{AppError, Result};
use crate::library::{models::Comic, repository as repo};
use crate::state::AppState;
use crate::util;

/// Ancho máximo de las miniaturas de portada (px).
const COVER_WIDTH: u32 = 400;

/// Archivo que no se pudo importar, con el motivo legible para mostrar al usuario.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFailure {
    pub path: String,
    pub reason: String,
}

/// Resultado de un lote de importación: lo que se logró importar y lo que falló.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<Comic>,
    pub failed: Vec<ImportFailure>,
}

#[tauri::command]
pub fn list_comics(state: State<'_, AppState>, pocket_id: Option<i64>) -> Result<Vec<Comic>> {
    state.with_db(|conn| repo::list_comics(conn, pocket_id))
}

/// Importa varios archivos a la biblioteca. Los archivos que fallen no abortan el
/// lote (importación resiliente): se reportan en `failed` con su motivo para que la
/// UI pueda explicar por qué un cómic no apareció.
#[tauri::command]
pub fn import_comics(
    state: State<'_, AppState>,
    paths: Vec<String>,
    pocket_id: Option<i64>,
) -> Result<ImportResult> {
    let library_dir = state.library_dir.clone();
    state.with_db(|conn| {
        let mut failed = Vec::new();
        for path_str in &paths {
            if let Err(err) = import_one(conn, path_str, &library_dir, pocket_id) {
                failed.push(ImportFailure {
                    path: path_str.clone(),
                    reason: err.to_string(),
                });
            }
        }
        let imported = repo::list_comics(conn, pocket_id)?;
        Ok(ImportResult { imported, failed })
    })
}

/// Copia el archivo de origen a la biblioteca propia de Tomo y devuelve la ruta
/// del destino. Si ya existe un archivo con ese nombre, lo reutiliza (evita
/// duplicar al reimportar el mismo cómic).
fn copy_into_library(src: &Path, library_dir: &Path) -> Result<PathBuf> {
    fs::create_dir_all(library_dir)?;
    let file_name = src
        .file_name()
        .ok_or_else(|| AppError::NotFound(format!("nombre de archivo de {src:?}")))?;
    let dest = library_dir.join(file_name);
    if !dest.exists() {
        fs::copy(src, &dest)?;
    }
    Ok(dest)
}

fn import_one(
    conn: &rusqlite::Connection,
    path_str: &str,
    library_dir: &Path,
    pocket_id: Option<i64>,
) -> Result<Comic> {
    let src = Path::new(path_str);
    // Validamos el archivo de origen antes de copiarlo a la biblioteca.
    let meta = archive::read_metadata(src)?;

    let stored = copy_into_library(src, library_dir)?;
    let stored_str = stored.to_string_lossy().to_string();

    let cover = meta
        .cover
        .as_deref()
        .and_then(|bytes| util::make_thumbnail(bytes, COVER_WIDTH).ok());

    let title = stored
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Sin título")
        .to_string();

    repo::insert_comic(
        conn,
        &title,
        &stored_str,
        meta.format.as_str(),
        meta.page_count as i64,
        cover,
        pocket_id,
    )
}

#[tauri::command]
pub fn move_comic(state: State<'_, AppState>, id: i64, pocket_id: Option<i64>) -> Result<()> {
    state.with_db(|conn| repo::move_comic(conn, id, pocket_id))
}

#[tauri::command]
pub fn delete_comic(state: State<'_, AppState>, id: i64) -> Result<()> {
    // Cierra cualquier sesión abierta antes de borrar el registro.
    state.with_sessions(|sessions| {
        sessions.remove(&id);
        Ok(())
    })?;

    // Borra la copia de la biblioteca propia (nunca el archivo original del
    // usuario: solo eliminamos si está dentro de `library_dir`).
    let library_dir = state.library_dir.clone();
    let comic = state.with_db(|conn| repo::get_comic(conn, id))?;
    let stored = PathBuf::from(&comic.path);
    if stored.starts_with(&library_dir) && stored.exists() {
        if let Err(err) = fs::remove_file(&stored) {
            eprintln!("No se pudo borrar la copia '{}': {err}", comic.path);
        }
    }

    state.with_db(|conn| repo::delete_comic(conn, id))
}
