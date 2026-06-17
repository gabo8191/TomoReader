use std::path::Path;

use rusqlite::Connection;

use crate::error::Result;

/// Abre (o crea) la base de datos SQLite y aplica las migraciones.
pub fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    // WAL mejora la concurrencia lectura/escritura; foreign_keys garantiza
    // la integridad referencial de las relaciones pocket → comic.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&conn)?;
    Ok(conn)
}

/// Aplica el esquema. Es idempotente (IF NOT EXISTS), así que puede ejecutarse
/// en cada arranque sin riesgo.
fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS pockets (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            color      TEXT NOT NULL DEFAULT '#F5A623',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS comics (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            pocket_id  INTEGER REFERENCES pockets(id) ON DELETE SET NULL,
            title      TEXT NOT NULL,
            path       TEXT NOT NULL UNIQUE,
            format     TEXT NOT NULL,
            page_count INTEGER NOT NULL DEFAULT 0,
            last_page  INTEGER NOT NULL DEFAULT 0,
            cover      BLOB,
            added_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_comics_pocket ON comics(pocket_id);

        CREATE TABLE IF NOT EXISTS highlights (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            comic_id    INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
            kind        TEXT NOT NULL DEFAULT 'phrase',
            text        TEXT NOT NULL,
            translation TEXT,
            source_lang TEXT,
            target_lang TEXT,
            location    TEXT,
            color       TEXT NOT NULL DEFAULT '#F5A623',
            note        TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_highlights_comic ON highlights(comic_id);
        ",
    )?;

    // `language` (idioma del libro) se añade aparte: ADD COLUMN no admite
    // IF NOT EXISTS, así que comprobamos antes para que la migración sea idempotente.
    add_column_if_missing(conn, "comics", "language", "TEXT")?;

    Ok(())
}

/// Añade una columna a una tabla solo si aún no existe (migración idempotente).
fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    col_type: &str,
) -> Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let exists = stmt
        .query_map([], |row| row.get::<_, String>("name"))?
        .filter_map(|r| r.ok())
        .any(|name| name == column);
    if !exists {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {col_type}"),
            [],
        )?;
    }
    Ok(())
}
