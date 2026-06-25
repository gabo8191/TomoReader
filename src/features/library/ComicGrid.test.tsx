import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComicGrid } from './ComicGrid';
import type { Comic, Pocket } from '@/types';

const POCKETS: Pocket[] = [];

const makeComic = (overrides: Partial<Comic> = {}): Comic => ({
  id: 1,
  pocketId: null,
  title: 'Mi libro',
  path: '/libro.epub',
  format: 'epub',
  pageCount: 100,
  lastPage: 0,
  cover: null,
  language: null,
  lastLocation: null,
  addedAt: '2026-01-01',
  ...overrides,
});

describe('ComicGrid — estados vacíos', () => {
  it('muestra el onboarding cuando la biblioteca está vacía (emptyContext library)', () => {
    render(
      <ComicGrid
        comics={[]}
        pockets={POCKETS}
        loading={false}
        onOpen={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
        emptyContext="library"
      />,
    );
    expect(screen.getByText(/tu biblioteca está vacía/i)).toBeDefined();
  });

  it('muestra el CTA de importar cuando se pasa onImport', () => {
    const onImport = vi.fn();
    render(
      <ComicGrid
        comics={[]}
        pockets={POCKETS}
        loading={false}
        onOpen={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
        emptyContext="library"
        onImport={onImport}
      />,
    );
    const cta = screen.getByRole('button', { name: /importar libros/i });
    fireEvent.click(cta);
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('muestra mensaje de filtro sin resultados cuando emptyContext es filter', () => {
    render(
      <ComicGrid
        comics={[]}
        pockets={POCKETS}
        loading={false}
        onOpen={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
        emptyContext="filter"
      />,
    );
    expect(screen.getByText(/no hay resultados con los filtros/i)).toBeDefined();
  });

  it('muestra el estado de carga', () => {
    render(
      <ComicGrid
        comics={[]}
        pockets={POCKETS}
        loading={true}
        onOpen={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/cargando biblioteca/i)).toBeDefined();
  });
});

describe('ComicGrid — navegación por teclado', () => {
  it('llama a onOpen al hacer clic en la portada', () => {
    const onOpen = vi.fn();
    render(
      <ComicGrid
        comics={[makeComic()]}
        pockets={POCKETS}
        loading={false}
        onOpen={onOpen}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /abrir mi libro/i });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('llama a onOpen al presionar Enter sobre la card enfocada', () => {
    const onOpen = vi.fn();
    render(
      <ComicGrid
        comics={[makeComic()]}
        pockets={POCKETS}
        loading={false}
        onOpen={onOpen}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /abrir mi libro/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalled();
  });

  it('la primera card tiene tabIndex 0', () => {
    render(
      <ComicGrid
        comics={[makeComic({ id: 1 }), makeComic({ id: 2, title: 'Otro' })]}
        pockets={POCKETS}
        loading={false}
        onOpen={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button', { name: /abrir/i });
    expect(buttons[0]?.getAttribute('tabindex')).toBe('0');
    expect(buttons[1]?.getAttribute('tabindex')).toBe('-1');
  });
});
