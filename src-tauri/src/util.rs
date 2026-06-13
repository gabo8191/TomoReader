use std::io::Cursor;

use image::ImageFormat;

use crate::error::Result;

/// Genera una miniatura JPEG a partir de los bytes de una imagen, limitando el
/// ancho a `max_width`. Se usa para las portadas de la biblioteca.
pub fn make_thumbnail(bytes: &[u8], max_width: u32) -> Result<Vec<u8>> {
    let img = image::load_from_memory(bytes)?;
    let resized = if img.width() > max_width {
        let ratio = f64::from(max_width) / f64::from(img.width());
        let height = (f64::from(img.height()) * ratio).round() as u32;
        img.thumbnail(max_width, height.max(1))
    } else {
        img
    };

    let mut out = Cursor::new(Vec::new());
    // `to_rgb8` descarta el canal alfa, que JPEG no soporta.
    resized.to_rgb8().write_to(&mut out, ImageFormat::Jpeg)?;
    Ok(out.into_inner())
}

/// Adivina el tipo MIME a partir de los primeros bytes (números mágicos).
pub fn guess_mime(bytes: &[u8]) -> &'static str {
    match bytes {
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x89, b'P', b'N', b'G', ..] => "image/png",
        [b'G', b'I', b'F', ..] => "image/gif",
        [b'R', b'I', b'F', b'F', ..] => "image/webp",
        [0x42, 0x4D, ..] => "image/bmp",
        _ => "image/jpeg",
    }
}

#[cfg(test)]
mod tests {
    use super::guess_mime;

    #[test]
    fn detects_common_formats() {
        assert_eq!(guess_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), "image/jpeg");
        assert_eq!(guess_mime(&[0x89, b'P', b'N', b'G']), "image/png");
        assert_eq!(guess_mime(b"GIF89a"), "image/gif");
        assert_eq!(guess_mime(b"RIFF....WEBP"), "image/webp");
    }
}
