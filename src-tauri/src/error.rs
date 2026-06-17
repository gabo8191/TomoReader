use serde::{Serialize, Serializer};

/// Error unificado de la aplicación. Se serializa como string para que los
/// comandos de Tauri puedan devolverlo al frontend de forma legible.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("error de E/S: {0}")]
    Io(#[from] std::io::Error),

    #[error("error de base de datos: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("error al leer el archivo CBZ/ZIP: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("error al leer el archivo CBR/RAR: {0}")]
    Rar(String),

    #[error("error al procesar la imagen: {0}")]
    Image(#[from] image::ImageError),

    #[error("formato no soportado: {0}")]
    UnsupportedFormat(String),

    #[error("error al traducir: {0}")]
    Translate(String),

    #[error("recurso no encontrado: {0}")]
    NotFound(String),

    #[error("estado de la aplicación bloqueado")]
    LockPoisoned,
}

pub type Result<T> = std::result::Result<T, AppError>;

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
