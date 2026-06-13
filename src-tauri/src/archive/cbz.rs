use std::fs::File;
use std::io::Read;
use std::path::Path;

use zip::ZipArchive;

use crate::error::Result;

use super::{is_image, sorting::natural_cmp};

/// Lista los nombres de las entradas de imagen, en orden natural de lectura.
pub fn list_pages(path: &Path) -> Result<Vec<String>> {
    let file = File::open(path)?;
    let mut zip = ZipArchive::new(file)?;

    let mut names = Vec::new();
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        if entry.is_file() {
            let name = entry.name().to_string();
            if is_image(&name) {
                names.push(name);
            }
        }
    }
    names.sort_by(|a, b| natural_cmp(a, b));
    Ok(names)
}

/// Lee los bytes de una entrada concreta por nombre.
pub fn read_entry(path: &Path, name: &str) -> Result<Vec<u8>> {
    let file = File::open(path)?;
    let mut zip = ZipArchive::new(file)?;
    let mut entry = zip.by_name(name)?;

    let mut buffer = Vec::with_capacity(entry.size() as usize);
    entry.read_to_end(&mut buffer)?;
    Ok(buffer)
}
