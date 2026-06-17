import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/settings-store';
import { LibraryView } from '@/features/library/LibraryView';
import { ReaderView } from '@/features/reader/ReaderView';
import { DocReader } from '@/features/reader/DocReader';
import { isDocumentFormat, type Comic } from '@/types';
import './App.css';

/**
 * Vista activa de la aplicación. Tomo es una SPA muy simple: la biblioteca y, según
 * el formato, el lector de imágenes (CBR/CBZ) o el de documentos (PDF/EPUB).
 */
type View = { name: 'library' } | { name: 'reader'; comic: Comic } | { name: 'doc'; comic: Comic };

export function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: 'library' });
  const theme = useSettings((s) => s.theme);

  // Aplica el tema como atributo en <html> para que el CSS lo consuma.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const openComic = (comic: Comic) =>
    setView(isDocumentFormat(comic.format) ? { name: 'doc', comic } : { name: 'reader', comic });
  const backToLibrary = () => setView({ name: 'library' });

  return (
    <div className="app">
      {view.name === 'library' && <LibraryView onOpenComic={openComic} />}
      {view.name === 'reader' && <ReaderView comicId={view.comic.id} onClose={backToLibrary} />}
      {view.name === 'doc' && <DocReader comic={view.comic} onClose={backToLibrary} />}
    </div>
  );
}
