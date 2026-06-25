/**
 * Utilidades puras del lector PDF, separadas del componente para que
 * fast-refresh funcione y para facilitar los tests unitarios.
 */

/**
 * Devuelve el número de página (base 1) cuyo contenedor está más cercano al tope
 * del viewport de scroll dado el array de offsets verticales de cada página.
 *
 * @param scrollTop - Posición actual de scroll del contenedor.
 * @param pageOffsets - Array de offsets superiores de cada página (base 0).
 * @returns Número de página base 1, o 1 si el array está vacío.
 */
export function nearestPageInViewport(scrollTop: number, pageOffsets: number[]): number {
  if (pageOffsets.length === 0) return 1;
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < pageOffsets.length; i++) {
    const offset = pageOffsets[i];
    if (offset === undefined) continue;
    const dist = Math.abs(offset - scrollTop);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  // Las páginas son base 1.
  return closest + 1;
}
