use serde::Deserialize;
use tauri::State;

use crate::error::Result;
use crate::library::models::Highlight;
use crate::library::repository as repo;
use crate::state::AppState;

/// Datos para crear un resaltado/entrada de vocabulario.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewHighlight {
    pub comic_id: i64,
    /// "word" o "phrase".
    pub kind: String,
    pub text: String,
    pub translation: Option<String>,
    pub source_lang: Option<String>,
    pub target_lang: Option<String>,
    pub location: Option<String>,
    pub color: Option<String>,
    pub note: Option<String>,
}

/// Color por defecto de un resaltado (acento de la marca).
const DEFAULT_COLOR: &str = "#F5A623";

/// Lista resaltados. Con `comicId` filtra por libro; sin él, todos (vocabulario).
#[tauri::command]
pub fn list_highlights(
    state: State<'_, AppState>,
    comic_id: Option<i64>,
) -> Result<Vec<Highlight>> {
    state.with_db(|conn| repo::list_highlights(conn, comic_id))
}

#[tauri::command]
pub fn create_highlight(state: State<'_, AppState>, highlight: NewHighlight) -> Result<Highlight> {
    let color = highlight.color.as_deref().unwrap_or(DEFAULT_COLOR);
    state.with_db(|conn| {
        repo::create_highlight(
            conn,
            highlight.comic_id,
            &highlight.kind,
            &highlight.text,
            highlight.translation.as_deref(),
            highlight.source_lang.as_deref(),
            highlight.target_lang.as_deref(),
            highlight.location.as_deref(),
            color,
            highlight.note.as_deref(),
        )
    })
}

#[tauri::command]
pub fn update_highlight_note(
    state: State<'_, AppState>,
    id: i64,
    note: Option<String>,
) -> Result<()> {
    state.with_db(|conn| repo::update_highlight_note(conn, id, note.as_deref()))
}

#[tauri::command]
pub fn delete_highlight(state: State<'_, AppState>, id: i64) -> Result<()> {
    state.with_db(|conn| repo::delete_highlight(conn, id))
}
