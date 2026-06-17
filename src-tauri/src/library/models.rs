use serde::Serialize;

/// Carpeta/pocket que agrupa cómics o mangas.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pocket {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub comic_count: i64,
    pub created_at: String,
}

/// Un cómic/manga registrado en la biblioteca.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Comic {
    pub id: i64,
    pub pocket_id: Option<i64>,
    pub title: String,
    pub path: String,
    pub format: String,
    pub page_count: i64,
    pub last_page: i64,
    /// Miniatura de portada como data URL (base64) o `None` si no se generó.
    pub cover: Option<String>,
    /// Idioma del libro (código ISO, p. ej. "en") para traducir. `None` = auto.
    pub language: Option<String>,
    pub added_at: String,
}

/// Frase o palabra resaltada/guardada en un documento (vocabulario tipo Kindle).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: i64,
    pub comic_id: i64,
    /// "word" o "phrase".
    pub kind: String,
    pub text: String,
    pub translation: Option<String>,
    pub source_lang: Option<String>,
    pub target_lang: Option<String>,
    /// Ancla de posición: CFI (EPUB) o página+rects (PDF), como JSON/string.
    pub location: Option<String>,
    pub color: String,
    pub note: Option<String>,
    pub created_at: String,
}

/// Sesión de lectura devuelta al abrir un cómic.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComicSession {
    pub comic_id: i64,
    pub page_count: i64,
    pub last_page: i64,
}

/// Una página renderizable, lista para usarse en `<img src>`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageImage {
    pub index: i64,
    pub data_url: String,
}
