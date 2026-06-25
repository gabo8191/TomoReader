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

/// Guarda el progreso de lectura de un documento PDF o EPUB.
///
/// - PDF: enviar `last_page` con el número de página (base 0); `last_location` puede omitirse.
/// - EPUB: enviar `last_location` con el CFI de posición; `last_page` puede omitirse.
/// - Se rechazan llamadas donde ambos campos son `None` (no hay nada que persistir).
#[tauri::command]
pub fn update_doc_progress(
    state: State<'_, AppState>,
    comic_id: i64,
    last_page: Option<i64>,
    last_location: Option<String>,
) -> Result<()> {
    // Validar que al menos un campo tenga valor útil
    if last_page.is_none()
        && last_location
            .as_deref()
            .map_or(true, |s| s.trim().is_empty())
    {
        return Err(AppError::UnsupportedFormat(
            "update_doc_progress requiere al menos last_page o last_location".to_string(),
        ));
    }
    // Normalizar: string vacío equivale a None
    let location = last_location.filter(|s| !s.trim().is_empty());
    state.with_db(|conn| repo::update_doc_progress(conn, comic_id, last_page, location.as_deref()))
}
