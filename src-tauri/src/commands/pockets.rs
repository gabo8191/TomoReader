use tauri::State;

use crate::error::Result;
use crate::library::{models::Pocket, repository as repo};
use crate::state::AppState;

#[tauri::command]
pub fn list_pockets(state: State<'_, AppState>) -> Result<Vec<Pocket>> {
    state.with_db(repo::list_pockets)
}

#[tauri::command]
pub fn create_pocket(state: State<'_, AppState>, name: String, color: String) -> Result<Pocket> {
    state.with_db(|conn| repo::create_pocket(conn, &name, &color))
}

#[tauri::command]
pub fn rename_pocket(state: State<'_, AppState>, id: i64, name: String) -> Result<()> {
    state.with_db(|conn| repo::rename_pocket(conn, id, &name))
}

#[tauri::command]
pub fn delete_pocket(state: State<'_, AppState>, id: i64) -> Result<()> {
    state.with_db(|conn| repo::delete_pocket(conn, id))
}
