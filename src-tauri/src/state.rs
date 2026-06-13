use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::archive::OpenedComic;
use crate::error::{AppError, Result};

/// Estado global compartido entre comandos de Tauri.
///
/// - `db`: conexión SQLite protegida por mutex (acceso serializado, suficiente
///   para una app de escritorio de un solo usuario).
/// - `sessions`: cómics actualmente abiertos para lectura, indexados por id.
/// - `cache_dir`: carpeta donde se extraen temporalmente las páginas de CBR.
pub struct AppState {
    db: Mutex<Connection>,
    sessions: Mutex<HashMap<i64, OpenedComic>>,
    pub cache_dir: PathBuf,
}

impl AppState {
    pub fn new(db: Connection, cache_dir: PathBuf) -> Self {
        Self {
            db: Mutex::new(db),
            sessions: Mutex::new(HashMap::new()),
            cache_dir,
        }
    }

    /// Ejecuta una operación con acceso exclusivo a la conexión de BD.
    pub fn with_db<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let conn = self.db.lock().map_err(|_| AppError::LockPoisoned)?;
        f(&conn)
    }

    /// Ejecuta una operación con acceso exclusivo a las sesiones abiertas.
    pub fn with_sessions<T>(
        &self,
        f: impl FnOnce(&mut HashMap<i64, OpenedComic>) -> Result<T>,
    ) -> Result<T> {
        let mut sessions = self.sessions.lock().map_err(|_| AppError::LockPoisoned)?;
        f(&mut sessions)
    }
}
