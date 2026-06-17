use serde::Serialize;
use serde_json::Value;

use crate::error::{AppError, Result};

/// Resultado de una traducción.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Translation {
    pub translation: String,
    /// Idioma de origen detectado por el servicio (útil cuando source = "auto").
    pub detected_source: Option<String>,
}

/// Traduce texto con el endpoint público de Google Translate (gratuito, sin API
/// key). Se llama desde el backend para evitar CORS. `source` admite "auto".
#[tauri::command]
pub fn translate(text: String, source: String, target: String) -> Result<Translation> {
    let text = text.trim();
    if text.is_empty() {
        return Ok(Translation {
            translation: String::new(),
            detected_source: None,
        });
    }

    let src = if source.trim().is_empty() {
        "auto"
    } else {
        source.trim()
    };
    let url = "https://translate.googleapis.com/translate_a/single";

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::Translate(e.to_string()))?;

    let resp = client
        .get(url)
        .query(&[
            ("client", "gtx"),
            ("sl", src),
            ("tl", target.trim()),
            ("dt", "t"),
            ("q", text),
        ])
        .send()
        .map_err(|e| AppError::Translate(e.to_string()))?
        .error_for_status()
        .map_err(|e| AppError::Translate(e.to_string()))?;

    let body: Value = resp
        .json()
        .map_err(|e| AppError::Translate(e.to_string()))?;

    // Estructura: [[["traducido","original",...], ...], null, "en", ...]
    let mut translation = String::new();
    if let Some(segments) = body.get(0).and_then(Value::as_array) {
        for seg in segments {
            if let Some(piece) = seg.get(0).and_then(Value::as_str) {
                translation.push_str(piece);
            }
        }
    }
    let detected_source = body.get(2).and_then(Value::as_str).map(ToString::to_string);

    if translation.is_empty() {
        return Err(AppError::Translate(
            "respuesta de traducción vacía o inesperada".to_string(),
        ));
    }

    Ok(Translation {
        translation,
        detected_source,
    })
}
