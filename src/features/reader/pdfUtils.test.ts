import { describe, it, expect } from 'vitest';
import { nearestPageInViewport } from './pdfUtils';

describe('nearestPageInViewport', () => {
  it('devuelve 1 cuando el array de offsets está vacío', () => {
    expect(nearestPageInViewport(0, [])).toBe(1);
  });

  it('devuelve la primera página cuando scrollTop es 0', () => {
    expect(nearestPageInViewport(0, [0, 800, 1600])).toBe(1);
  });

  it('devuelve la página más cercana al scrollTop exacto', () => {
    // offsets: página 1 en 0, página 2 en 800, página 3 en 1600
    expect(nearestPageInViewport(800, [0, 800, 1600])).toBe(2);
  });

  it('devuelve la página más cercana cuando scrollTop es entre dos páginas', () => {
    // scrollTop=500 está más cerca de página 2 (offset 800, dist=300) que de 1 (offset 0, dist=500)
    expect(nearestPageInViewport(500, [0, 800, 1600])).toBe(2);
  });

  it('devuelve la última página cuando scrollTop supera todos los offsets', () => {
    expect(nearestPageInViewport(9999, [0, 800, 1600])).toBe(3);
  });

  it('devuelve la página correcta con un solo elemento', () => {
    expect(nearestPageInViewport(42, [100])).toBe(1);
  });

  it('rompe empates por el primero (índice menor)', () => {
    // scrollTop=400 → equidistante entre offset 0 (dist=400) y offset 800 (dist=400)
    // el algoritmo elige el primero al encontrarlo antes con minDist estricto.
    expect(nearestPageInViewport(400, [0, 800])).toBe(1);
  });
});
