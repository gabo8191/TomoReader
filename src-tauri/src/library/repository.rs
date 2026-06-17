//! Patrón Repository: encapsula todo el acceso SQL a pockets y cómics.
//! El resto de la aplicación nunca escribe SQL directamente.

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use rusqlite::{params, Connection, Row};

use crate::error::{AppError, Result};

use super::models::{Comic, Highlight, Pocket};

fn cover_to_data_url(cover: Option<Vec<u8>>) -> Option<String> {
    cover.map(|bytes| format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes)))
}

fn row_to_comic(row: &Row<'_>) -> rusqlite::Result<Comic> {
    let cover: Option<Vec<u8>> = row.get("cover")?;
    Ok(Comic {
        id: row.get("id")?,
        pocket_id: row.get("pocket_id")?,
        title: row.get("title")?,
        path: row.get("path")?,
        format: row.get("format")?,
        page_count: row.get("page_count")?,
        last_page: row.get("last_page")?,
        cover: cover_to_data_url(cover),
        language: row.get("language")?,
        added_at: row.get("added_at")?,
    })
}

fn row_to_highlight(row: &Row<'_>) -> rusqlite::Result<Highlight> {
    Ok(Highlight {
        id: row.get("id")?,
        comic_id: row.get("comic_id")?,
        kind: row.get("kind")?,
        text: row.get("text")?,
        translation: row.get("translation")?,
        source_lang: row.get("source_lang")?,
        target_lang: row.get("target_lang")?,
        location: row.get("location")?,
        color: row.get("color")?,
        note: row.get("note")?,
        created_at: row.get("created_at")?,
    })
}

// ── Pockets ────────────────────────────────────────────────────────────────

pub fn list_pockets(conn: &Connection) -> Result<Vec<Pocket>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.color, p.created_at,
                (SELECT COUNT(*) FROM comics c WHERE c.pocket_id = p.id) AS comic_count
         FROM pockets p
         ORDER BY p.name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Pocket {
            id: row.get("id")?,
            name: row.get("name")?,
            color: row.get("color")?,
            comic_count: row.get("comic_count")?,
            created_at: row.get("created_at")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get_pocket(conn: &Connection, id: i64) -> Result<Pocket> {
    conn.query_row(
        "SELECT p.id, p.name, p.color, p.created_at,
                (SELECT COUNT(*) FROM comics c WHERE c.pocket_id = p.id) AS comic_count
         FROM pockets p WHERE p.id = ?1",
        params![id],
        |row| {
            Ok(Pocket {
                id: row.get("id")?,
                name: row.get("name")?,
                color: row.get("color")?,
                comic_count: row.get("comic_count")?,
                created_at: row.get("created_at")?,
            })
        },
    )
    .map_err(|_| AppError::NotFound(format!("pocket {id}")))
}

pub fn create_pocket(conn: &Connection, name: &str, color: &str) -> Result<Pocket> {
    conn.execute(
        "INSERT INTO pockets (name, color) VALUES (?1, ?2)",
        params![name, color],
    )?;
    get_pocket(conn, conn.last_insert_rowid())
}

pub fn rename_pocket(conn: &Connection, id: i64, name: &str) -> Result<()> {
    conn.execute(
        "UPDATE pockets SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    Ok(())
}

pub fn delete_pocket(conn: &Connection, id: i64) -> Result<()> {
    // ON DELETE SET NULL deja los cómics en "Todos" en lugar de borrarlos.
    conn.execute("DELETE FROM pockets WHERE id = ?1", params![id])?;
    Ok(())
}

// ── Cómics ─────────────────────────────────────────────────────────────────

pub fn list_comics(conn: &Connection, pocket_id: Option<i64>) -> Result<Vec<Comic>> {
    let mut comics = Vec::new();
    match pocket_id {
        Some(pid) => {
            let mut stmt = conn.prepare(
                "SELECT * FROM comics WHERE pocket_id = ?1 ORDER BY title COLLATE NOCASE",
            )?;
            let rows = stmt.query_map(params![pid], row_to_comic)?;
            for c in rows {
                comics.push(c?);
            }
        }
        None => {
            let mut stmt = conn.prepare("SELECT * FROM comics ORDER BY title COLLATE NOCASE")?;
            let rows = stmt.query_map([], row_to_comic)?;
            for c in rows {
                comics.push(c?);
            }
        }
    }
    Ok(comics)
}

pub fn get_comic(conn: &Connection, id: i64) -> Result<Comic> {
    conn.query_row(
        "SELECT * FROM comics WHERE id = ?1",
        params![id],
        row_to_comic,
    )
    .map_err(|_| AppError::NotFound(format!("cómic {id}")))
}

/// Inserta un cómic. Si la ruta ya existe, devuelve el registro existente
/// (importación idempotente).
pub fn insert_comic(
    conn: &Connection,
    title: &str,
    path: &str,
    format: &str,
    page_count: i64,
    cover: Option<Vec<u8>>,
    pocket_id: Option<i64>,
) -> Result<Comic> {
    conn.execute(
        "INSERT INTO comics (title, path, format, page_count, cover, pocket_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(path) DO NOTHING",
        params![title, path, format, page_count, cover, pocket_id],
    )?;
    conn.query_row(
        "SELECT * FROM comics WHERE path = ?1",
        params![path],
        row_to_comic,
    )
    .map_err(|_| AppError::NotFound(format!("cómic {path}")))
}

pub fn update_progress(conn: &Connection, id: i64, last_page: i64) -> Result<()> {
    conn.execute(
        "UPDATE comics SET last_page = ?1 WHERE id = ?2",
        params![last_page, id],
    )?;
    Ok(())
}

pub fn move_comic(conn: &Connection, id: i64, pocket_id: Option<i64>) -> Result<()> {
    conn.execute(
        "UPDATE comics SET pocket_id = ?1 WHERE id = ?2",
        params![pocket_id, id],
    )?;
    Ok(())
}

pub fn delete_comic(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM comics WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn set_comic_language(conn: &Connection, id: i64, language: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE comics SET language = ?1 WHERE id = ?2",
        params![language, id],
    )?;
    Ok(())
}

// ── Highlights / vocabulario ─────────────────────────────────────────────────

/// Lista los resaltados. Con `comic_id` filtra por libro; sin él, todos (vocabulario).
pub fn list_highlights(conn: &Connection, comic_id: Option<i64>) -> Result<Vec<Highlight>> {
    let mut out = Vec::new();
    match comic_id {
        Some(cid) => {
            let mut stmt = conn
                .prepare("SELECT * FROM highlights WHERE comic_id = ?1 ORDER BY created_at DESC")?;
            let rows = stmt.query_map(params![cid], row_to_highlight)?;
            for h in rows {
                out.push(h?);
            }
        }
        None => {
            let mut stmt = conn.prepare("SELECT * FROM highlights ORDER BY created_at DESC")?;
            let rows = stmt.query_map([], row_to_highlight)?;
            for h in rows {
                out.push(h?);
            }
        }
    }
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
pub fn create_highlight(
    conn: &Connection,
    comic_id: i64,
    kind: &str,
    text: &str,
    translation: Option<&str>,
    source_lang: Option<&str>,
    target_lang: Option<&str>,
    location: Option<&str>,
    color: &str,
    note: Option<&str>,
) -> Result<Highlight> {
    conn.execute(
        "INSERT INTO highlights
            (comic_id, kind, text, translation, source_lang, target_lang, location, color, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            comic_id,
            kind,
            text,
            translation,
            source_lang,
            target_lang,
            location,
            color,
            note
        ],
    )?;
    conn.query_row(
        "SELECT * FROM highlights WHERE id = ?1",
        params![conn.last_insert_rowid()],
        row_to_highlight,
    )
    .map_err(|_| AppError::NotFound("highlight recién creado".to_string()))
}

pub fn update_highlight_note(conn: &Connection, id: i64, note: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE highlights SET note = ?1 WHERE id = ?2",
        params![note, id],
    )?;
    Ok(())
}

pub fn delete_highlight(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM highlights WHERE id = ?1", params![id])?;
    Ok(())
}
