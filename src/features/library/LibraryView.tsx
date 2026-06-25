import { useState } from 'react';
import { useLibrary } from './useLibrary';
import { PocketSidebar } from './PocketSidebar';
import { ComicGrid } from './ComicGrid';
import { LibraryFilters } from './LibraryFilters';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { VocabularyView } from '@/features/vocabulary/VocabularyView';
import { Icon } from '@/components/Icon';
import './library.css';

import type { Comic } from '@/types';

interface LibraryViewProps {
  onOpenComic: (comic: Comic) => void;
}

export function LibraryView({ onOpenComic }: LibraryViewProps): JSX.Element {
  const lib = useLibrary();
  const [showSettings, setShowSettings] = useState(false);
  const [showVocab, setShowVocab] = useState(false);

  const activePocketName =
    lib.selectedPocket === null
      ? 'Todos los cómics'
      : (lib.pockets.find((p) => p.id === lib.selectedPocket)?.name ?? 'Pocket');

  return (
    <div className="library">
      <PocketSidebar
        pockets={lib.pockets}
        selected={lib.selectedPocket}
        onSelect={(id) => void lib.loadComics(id)}
        onCreate={(name, color) => void lib.createPocket(name, color)}
        onRename={(id, name) => void lib.renamePocket(id, name)}
        onDelete={(id) => void lib.deletePocket(id)}
      />

      <main className="library__main">
        <header className="library__header">
          <h1 className="library__title">{activePocketName}</h1>
          <div className="library__actions">
            <button className="btn btn--ghost" onClick={() => setShowVocab(true)}>
              <Icon name="theme" size={18} />
              Vocabulario
            </button>
            <button className="btn btn--ghost" onClick={() => setShowSettings(true)}>
              <Icon name="settings" size={18} />
              Ajustes
            </button>
            <button className="btn btn--primary" onClick={() => void lib.importComics()}>
              <Icon name="plus" size={18} />
              Importar
            </button>
          </div>
        </header>

        <LibraryFilters
          filters={lib.filters}
          onToggleFormat={lib.toggleFormat}
          onSetSince={lib.setSince}
          onSetSortBy={lib.setSortBy}
        />

        {lib.error && (
          <div className="library__error" role="alert">
            <span>{lib.error}</span>
            <button className="btn btn--ghost" onClick={lib.dismissError}>
              Cerrar
            </button>
          </div>
        )}

        <ComicGrid
          comics={lib.visibleComics}
          pockets={lib.pockets}
          loading={lib.loading}
          onOpen={onOpenComic}
          onMove={(id, pocketId) => void lib.moveComic(id, pocketId)}
          onDelete={(id) => void lib.deleteComic(id)}
          onImport={() => void lib.importComics()}
          emptyContext={lib.comics.length === 0 ? 'library' : 'filter'}
        />
      </main>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showVocab && <VocabularyView onClose={() => setShowVocab(false)} />}
    </div>
  );
}
