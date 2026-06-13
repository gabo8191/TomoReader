import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/settings-store';
import { LibraryView } from '@/features/library/LibraryView';
import { ReaderView } from '@/features/reader/ReaderView';
import './App.css';

/**
 * Vista activa de la aplicación. Tomo es una SPA muy simple con dos pantallas:
 * la biblioteca (pockets + cómics) y el lector a pantalla completa.
 */
type View = { name: 'library' } | { name: 'reader'; comicId: number };

export function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: 'library' });
  const theme = useSettings((s) => s.theme);

  // Aplica el tema como atributo en <html> para que el CSS lo consuma.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      {view.name === 'library' ? (
        <LibraryView onOpenComic={(comicId) => setView({ name: 'reader', comicId })} />
      ) : (
        <ReaderView comicId={view.comicId} onClose={() => setView({ name: 'library' })} />
      )}
    </div>
  );
}
