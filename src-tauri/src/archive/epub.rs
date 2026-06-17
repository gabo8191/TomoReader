//! Extracción de la imagen de portada de un archivo EPUB (un ZIP con un OPF).
//!
//! Estrategia barata, sin dependencia de parser XML: localizar el OPF vía
//! `META-INF/container.xml`, buscar el ítem de portada (EPUB3 `properties` o
//! EPUB2 `<meta name="cover">`) y, si nada cuadra, caer a la primera imagen cuyo
//! nombre contenga «cover».

use std::fs::File;
use std::io::Read;
use std::path::Path;

use zip::ZipArchive;

use crate::error::Result;

use super::is_image;

type Zip = ZipArchive<File>;

/// Lee los bytes de la portada de un EPUB, o `None` si no se puede localizar.
pub fn read_cover(path: &Path) -> Result<Option<Vec<u8>>> {
    let file = File::open(path)?;
    let mut zip = ZipArchive::new(file)?;

    // 1) Ruta declarada en el OPF (camino fiable).
    if let Some(href) = cover_href(&mut zip) {
        if let Ok(bytes) = read_entry(&mut zip, &href) {
            return Ok(Some(bytes));
        }
    }

    // 2) Fallback: primera imagen cuyo nombre contenga «cover».
    let names: Vec<String> = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|e| e.name().to_string()))
        .collect();
    if let Some(name) = names
        .into_iter()
        .find(|n| is_image(n) && n.to_ascii_lowercase().contains("cover"))
    {
        return Ok(Some(read_entry(&mut zip, &name)?));
    }

    Ok(None)
}

/// Resuelve la ruta (dentro del ZIP) de la imagen de portada según el OPF.
fn cover_href(zip: &mut Zip) -> Option<String> {
    let container = read_text(zip, "META-INF/container.xml")?;
    let opf_path = attr_after(&container, "full-path")?;
    let opf = read_text(zip, &opf_path)?;
    let opf_dir = opf_path.rsplit_once('/').map(|(d, _)| d).unwrap_or("");

    let href = cover_image_href(&opf).or_else(|| cover_meta_href(&opf))?;
    Some(join_zip_path(opf_dir, &href))
}

/// EPUB3: `<item ... properties="cover-image" href="..."/>`.
fn cover_image_href(opf: &str) -> Option<String> {
    let pos = opf.find("cover-image")?;
    let tag_start = opf[..pos].rfind("<item")?;
    let tag_end = opf[tag_start..].find('>')? + tag_start;
    attr_after(&opf[tag_start..tag_end], "href")
}

/// EPUB2: `<meta name="cover" content="ID"/>` + `<item id="ID" href="..."/>`.
fn cover_meta_href(opf: &str) -> Option<String> {
    let meta_pos = opf
        .find("name=\"cover\"")
        .or_else(|| opf.find("name='cover'"))?;
    let tag_start = opf[..meta_pos].rfind("<meta")?;
    let tag_end = opf[tag_start..].find('>')? + tag_start;
    let id = attr_after(&opf[tag_start..tag_end], "content")?;

    let id_pos = opf
        .find(&format!("id=\"{id}\""))
        .or_else(|| opf.find(&format!("id='{id}'")))?;
    let tag_start = opf[..id_pos].rfind("<item")?;
    let tag_end = opf[tag_start..].find('>')? + tag_start;
    attr_after(&opf[tag_start..tag_end], "href")
}

/// Devuelve el valor del atributo `key="..."` (o `key='...'`) en un fragmento XML.
fn attr_after(xml: &str, key: &str) -> Option<String> {
    let at = xml.find(key)?;
    let rest = xml[at + key.len()..].trim_start();
    let rest = rest.strip_prefix('=')?.trim_start();
    let quote = rest.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let rest = &rest[1..];
    let end = rest.find(quote)?;
    Some(rest[..end].to_string())
}

/// Une el directorio del OPF con un href relativo. ponytail: solo resuelve el caso
/// común (decodifica «%20»); rutas con «../» o codificaciones raras caen al fallback.
fn join_zip_path(dir: &str, href: &str) -> String {
    let href = href.replace("%20", " ");
    if dir.is_empty() {
        href
    } else {
        format!("{dir}/{href}")
    }
}

fn read_text(zip: &mut Zip, name: &str) -> Option<String> {
    let mut entry = zip.by_name(name).ok()?;
    let mut s = String::new();
    entry.read_to_string(&mut s).ok()?;
    Some(s)
}

fn read_entry(zip: &mut Zip, name: &str) -> Result<Vec<u8>> {
    let mut entry = zip.by_name(name)?;
    let mut buf = Vec::with_capacity(entry.size() as usize);
    entry.read_to_end(&mut buf)?;
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::attr_after;

    #[test]
    fn reads_attribute_values() {
        assert_eq!(
            attr_after(r#"<item href="OEBPS/cover.xhtml" id="x"/>"#, "href").as_deref(),
            Some("OEBPS/cover.xhtml")
        );
        assert_eq!(
            attr_after(r#"<meta name='cover' content='cov-id'/>"#, "content").as_deref(),
            Some("cov-id")
        );
        assert_eq!(attr_after("<item/>", "href"), None);
    }
}
