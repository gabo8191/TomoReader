import { useState } from 'react';
import { useLibrary } from './useLibrary';
import { PocketSidebar } from './PocketSidebar';
import { ComicGrid } from './ComicGrid';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { Icon } from '@/components/Icon';
import './library.css';

interface LibraryViewProps {
  onOpenComic: (comicId: number) => void;
}

export function LibraryView({ onOpenComic }: LibraryViewProps): JSX.Element {
  const lib = useLibrary();
  const [showSettings, setShowSettings] = useState(false);

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
            <button className="btn btn--ghost" onClick={() => setShowSettings(true)}>
              <Icon name="settings" size={18} />
              Ajustes
            </button>
            <button className="btn btn--primary" onClick={() => void lib.importComics()}>
              <Icon name="plus" size={18} />
              Importar cómics
            </button>
          </div>
        </header>

        {lib.error && (
          <div className="library__error" role="alert">
            <span>{lib.error}</span>
            <button className="btn btn--ghost" onClick={lib.dismissError}>
              Cerrar
            </button>
          </div>
        )}

        <ComicGrid
          comics={lib.comics}
          pockets={lib.pockets}
          loading={lib.loading}
          onOpen={onOpenComic}
          onMove={(id, pocketId) => void lib.moveComic(id, pocketId)}
          onDelete={(id) => void lib.deleteComic(id)}
        />
      </main>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
