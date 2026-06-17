use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use tauri::State;

use crate::archive::OpenedComic;
use crate::error::{AppError, Result};
use crate::library::models::{ComicSession, PageImage};
use crate::library::repository as repo;
use crate::state::AppState;
use crate::util;

/// Abre un cómic para lectura y registra la sesión en memoria.
///
/// Si ya hay una sesión abierta para este cómic, se reutiliza tal cual. Volver a
/// extraer (caso CBR) sobre el mismo directorio temporal provocaba que el `Drop`
/// de la sesión vieja borrara las páginas de la nueva → "error de E/S" al leer.
#[tauri::command]
pub fn open_comic(state: State<'_, AppState>, id: i64) -> Result<ComicSession> {
    let comic = state.with_db(|conn| repo::get_comic(conn, id))?;

    // Reutiliza la sesión existente si ya estaba abierta.
    if let Some(page_count) =
        state.with_sessions(|sessions| Ok(sessions.get(&id).map(|o| o.page_count() as i64)))?
    {
        return Ok(ComicSession {
            comic_id: id,
            page_count,
            last_page: comic.last_page,
        });
    }

    // Mensaje claro si el archivo ya no está (p. ej. importado por referencia
    // desde una ruta temporal que luego desapareció).
    let path = Path::new(&comic.path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "el archivo de «{}» ya no existe. Vuelve a importarlo.",
            comic.title
        )));
    }

    let opened = OpenedComic::open(path, &state.cache_dir, id)?;
    let page_count = opened.page_count() as i64;

    state.with_sessions(|sessions| {
        sessions.insert(id, opened);
        Ok(())
    })?;

    Ok(ComicSession {
        comic_id: id,
        page_count,
        last_page: comic.last_page,
    })
}

/// Cierra la sesión de lectura y libera las páginas temporales (CBR). Se llama al
/// salir del lector para no acumular sesiones ni archivos extraídos en caché.
#[tauri::command]
pub fn close_comic(state: State<'_, AppState>, comic_id: i64) -> Result<()> {
    state.with_sessions(|sessions| {
        sessions.remove(&comic_id);
        Ok(())
    })
}

/// Devuelve una página como data URL lista para `<img src>`.
#[tauri::command]
pub fn get_page(state: State<'_, AppState>, comic_id: i64, index: i64) -> Result<PageImage> {
    if index < 0 {
        return Err(AppError::NotFound(format!("página {index}")));
    }

    state.with_sessions(|sessions| {
        let opened = sessions
            .get(&comic_id)
            .ok_or_else(|| AppError::NotFound(format!("sesión del cómic {comic_id}")))?;

        let bytes = opened.read_page(index as usize)?;
        let mime = util::guess_mime(&bytes);
        let data_url = format!("data:{mime};base64,{}", STANDARD.encode(&bytes));
        Ok(PageImage { index, data_url })
    })
}

/// Guarda la última página leída.
#[tauri::command]
pub fn update_progress(state: State<'_, AppState>, comic_id: i64, last_page: i64) -> Result<()> {
    state.with_db(|conn| repo::update_progress(conn, comic_id, last_page))
}
