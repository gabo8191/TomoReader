import type { ComicFormat } from '@/types';
import type { LibraryFilters as Filters, SortBy } from './useLibrary';

interface LibraryFiltersProps {
  filters: Filters;
  onToggleFormat: (format: ComicFormat) => void;
  onSetSince: (since: string) => void;
  onSetSortBy: (sortBy: SortBy) => void;
}

const FORMATS: ComicFormat[] = ['cbr', 'cbz', 'pdf', 'epub'];
const SORTS: { value: SortBy; label: string }[] = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'title', label: 'Título A-Z' },
];

/** Barra de filtros de la biblioteca: formato, fecha de adición y orden. */
export function LibraryFilters({
  filters,
  onToggleFormat,
  onSetSince,
  onSetSortBy,
}: LibraryFiltersProps): JSX.Element {
  return (
    <div className="filters">
      <div className="filters__formats">
        {FORMATS.map((f) => (
          <button
            key={f}
            className={filters.formats.includes(f) ? 'chip chip--active' : 'chip'}
            onClick={() => onToggleFormat(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <label className="filters__field">
        Desde
        <input type="date" value={filters.since} onChange={(e) => onSetSince(e.target.value)} />
      </label>

      <label className="filters__field">
        Orden
        <select value={filters.sortBy} onChange={(e) => onSetSortBy(e.target.value as SortBy)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
