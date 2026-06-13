mod comics;
mod pockets;
mod reader;

// Glob para re-exportar también los items que genera `#[tauri::command]`
// (`__cmd__*`, `__tauri_command_name_*`), que `generate_handler!` necesita.
pub use comics::*;
pub use pockets::*;
pub use reader::*;
