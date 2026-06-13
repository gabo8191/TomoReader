mod archive;
mod commands;
mod error;
mod library;
mod state;
mod util;

use tauri::Manager;

use crate::state::AppState;

/// Punto de entrada de la aplicación Tomo.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Base de datos en el directorio de datos de la app.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = library::db::open(&data_dir.join("tomo.db"))?;

            // Carpeta de caché para las páginas extraídas de archivos CBR.
            let cache_dir = app.path().app_cache_dir()?.join("pages");
            std::fs::create_dir_all(&cache_dir)?;

            // Carpeta propia donde se copian los cómics importados.
            let library_dir = data_dir.join("library");
            std::fs::create_dir_all(&library_dir)?;

            app.manage(AppState::new(conn, cache_dir, library_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_pockets,
            commands::create_pocket,
            commands::rename_pocket,
            commands::delete_pocket,
            commands::list_comics,
            commands::import_comics,
            commands::move_comic,
            commands::delete_comic,
            commands::open_comic,
            commands::get_page,
            commands::update_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error fatal al ejecutar Tomo");
}
