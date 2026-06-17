use std::fs;
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::Serialize;
use tauri::State;

use crate::archive::Format;
use crate::error::{AppError, Result};
use crate::library::repository as repo;
use crate::state::AppState;

/// Bytes de un documento (PDF/EPUB) listos para pdf.js/epub.js en el webview.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentData {
    /// Contenido del archivo en base64 (el frontend lo pasa a ArrayBuffer).
    pub data_base64: String,
    /// "pdf" o "epub".
    pub format: String,
}

/// Devuelve el contenido de un documento PDF/EPUB para renderizarlo en el webview.
/// Rechaza formatos de cómic (CBR/CBZ), que usan el lector de imágenes.
#[tauri::command]
pub fn read_document(state: State<'_, AppState>, comic_id: i64) -> Result<DocumentData> {
    let comic = state.with_db(|conn| repo::get_comic(conn, comic_id))?;
    let path = Path::new(&comic.path);

    let format = Format::from_path(path)?;
    if !format.is_document() {
        return Err(AppError::UnsupportedFormat(format!(
            "«{}» no es un documento PDF/EPUB",
            comic.title
        )));
    }
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "el archivo de «{}» ya no existe. Vuelve a importarlo.",
            comic.title
        )));
    }

    let bytes = fs::read(path)?;
    Ok(DocumentData {
        data_base64: STANDARD.encode(&bytes),
        format: format.as_str().to_string(),
    })
}

/// Configura el idioma del libro (código ISO, p. ej. "en"). `None`/vacío = auto.
#[tauri::command]
pub fn set_comic_language(
    state: State<'_, AppState>,
    comic_id: i64,
    language: Option<String>,
) -> Result<()> {
    let lang = language.filter(|l| !l.trim().is_empty());
    state.with_db(|conn| repo::set_comic_language(conn, comic_id, lang.as_deref()))
}
