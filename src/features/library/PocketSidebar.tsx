import { useState } from 'react';
import { Icon } from '@/components/Icon';
import type { Pocket } from '@/types';

interface PocketSidebarProps {
  pockets: Pocket[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onCreate: (name: string, color: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}

const POCKET_COLORS = ['#F5A623', '#E8743B', '#3DA9A3', '#6C8EBF', '#B07ED9', '#D96C8E'];

export function PocketSidebar({
  pockets,
  selected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: PocketSidebarProps): JSX.Element {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(POCKET_COLORS[0] as string);
  // Id del pocket en edición de nombre (null = ninguno).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const commitRename = () => {
    const trimmed = editName.trim();
    if (editingId !== null && trimmed) onRename(editingId, trimmed);
    setEditingId(null);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, color);
    setName('');
    setCreating(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="/logo.svg" alt="" width={28} height={28} />
        <span>TomoReader</span>
      </div>

      <nav className="sidebar__nav">
        <button
          className={`pocket ${selected === null ? 'pocket--active' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="pocket__dot" style={{ background: 'var(--text-muted)' }} />
          <span className="pocket__name">Todos</span>
        </button>

        {pockets.map((pocket) => (
          <div key={pocket.id} className="pocket-row">
            {editingId === pocket.id ? (
              <input
                autoFocus
                className="sidebar__input pocket__rename"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <button
                className={`pocket ${selected === pocket.id ? 'pocket--active' : ''}`}
                onClick={() => onSelect(pocket.id)}
                onDoubleClick={() => {
                  setEditingId(pocket.id);
                  setEditName(pocket.name);
                }}
                title="Doble clic para renombrar"
              >
                <span className="pocket__dot" style={{ background: pocket.color }} />
                <span className="pocket__name">{pocket.name}</span>
                <span className="pocket__count">{pocket.comicCount}</span>
              </button>
            )}
            <button
              className="pocket__delete"
              title="Eliminar pocket"
              onClick={() => onDelete(pocket.id)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </nav>

      {creating ? (
        <div className="sidebar__create">
          <input
            autoFocus
            className="sidebar__input"
            placeholder="Nombre del pocket"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setCreating(false);
            }}
          />
          <div className="sidebar__colors">
            {POCKET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-dot ${color === c ? 'color-dot--active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="sidebar__create-actions">
            <button className="btn btn--ghost" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button className="btn btn--primary" onClick={submit}>
              Crear
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn--ghost sidebar__add" onClick={() => setCreating(true)}>
          <Icon name="folder" size={18} />
          Nuevo pocket
        </button>
      )}
    </aside>
  );
}
