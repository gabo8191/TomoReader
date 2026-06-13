use std::path::Path;

use tauri::State;

use crate::archive;
use crate::error::Result;
use crate::library::{models::Comic, repository as repo};
use crate::state::AppState;
use crate::util;

/// Ancho máximo de las miniaturas de portada (px).
const COVER_WIDTH: u32 = 400;

#[tauri::command]
pub fn list_comics(state: State<'_, AppState>, pocket_id: Option<i64>) -> Result<Vec<Comic>> {
    state.with_db(|conn| repo::list_comics(conn, pocket_id))
}

/// Importa varios archivos a la biblioteca. Los archivos que fallen se omiten
/// (importación resiliente) para no abortar todo el lote por uno corrupto.
#[tauri::command]
pub fn import_comics(
    state: State<'_, AppState>,
    paths: Vec<String>,
    pocket_id: Option<i64>,
) -> Result<Vec<Comic>> {
    state.with_db(|conn| {
        for path_str in &paths {
            if let Err(err) = import_one(conn, path_str, pocket_id) {
                // Registramos y continuamos con el resto del lote.
                eprintln!("No se pudo importar '{path_str}': {err}");
            }
        }
        repo::list_comics(conn, pocket_id)
    })
}

fn import_one(
    conn: &rusqlite::Connection,
    path_str: &str,
    pocket_id: Option<i64>,
) -> Result<Comic> {
    let path = Path::new(path_str);
    let meta = archive::read_metadata(path)?;

    let cover = meta
        .cover
        .as_deref()
        .and_then(|bytes| util::make_thumbnail(bytes, COVER_WIDTH).ok());

    let title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Sin título")
        .to_string();

    repo::insert_comic(
        conn,
        &title,
        path_str,
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
    state.with_db(|conn| repo::delete_comic(conn, id))
}
