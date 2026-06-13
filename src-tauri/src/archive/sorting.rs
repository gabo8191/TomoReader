use std::cmp::Ordering;
use std::iter::Peekable;
use std::str::Chars;

/// Comparación natural de nombres de archivo: garantiza que `"page2"` se
/// ordene antes que `"page10"`, en lugar del orden lexicográfico ASCII.
pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    let mut ai = a.chars().peekable();
    let mut bi = b.chars().peekable();

    loop {
        match (ai.peek().copied(), bi.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(ca), Some(cb)) => {
                if ca.is_ascii_digit() && cb.is_ascii_digit() {
                    match take_number(&mut ai).cmp(&take_number(&mut bi)) {
                        Ordering::Equal => continue,
                        ord => return ord,
                    }
                } else {
                    match ca.to_ascii_lowercase().cmp(&cb.to_ascii_lowercase()) {
                        Ordering::Equal => {
                            ai.next();
                            bi.next();
                        }
                        ord => return ord,
                    }
                }
            }
        }
    }
}

/// Consume una secuencia de dígitos del iterador y la interpreta como número.
fn take_number(it: &mut Peekable<Chars<'_>>) -> u64 {
    let mut value: u64 = 0;
    while let Some(c) = it.peek().copied() {
        match c.to_digit(10) {
            Some(d) => {
                value = value.saturating_mul(10).saturating_add(u64::from(d));
                it.next();
            }
            None => break,
        }
    }
    value
}

#[cfg(test)]
mod tests {
    use super::natural_cmp;
    use std::cmp::Ordering;

    #[test]
    fn orders_numbers_naturally() {
        assert_eq!(natural_cmp("page2.jpg", "page10.jpg"), Ordering::Less);
        assert_eq!(natural_cmp("page10.jpg", "page2.jpg"), Ordering::Greater);
    }

    #[test]
    fn is_case_insensitive() {
        assert_eq!(natural_cmp("Cover.png", "cover.png"), Ordering::Equal);
    }

    #[test]
    fn sorts_a_realistic_set() {
        let mut names = vec!["p10.jpg", "p1.jpg", "p2.jpg", "cover.jpg"];
        names.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(names, vec!["cover.jpg", "p1.jpg", "p2.jpg", "p10.jpg"]);
    }
}
