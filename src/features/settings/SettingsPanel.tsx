import { useSettings } from '@/lib/settings-store';
import type { FitMode, ReadingDirection, ReadingTheme } from '@/types';
import './settings.css';

interface SettingsPanelProps {
  onClose: () => void;
}

const THEMES: { value: ReadingTheme; label: string }[] = [
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'oled', label: 'OLED' },
  { value: 'light', label: 'Claro' },
];

const FIT_MODES: { value: FitMode; label: string }[] = [
  { value: 'height', label: 'Alto' },
  { value: 'width', label: 'Ancho' },
  { value: 'original', label: 'Original' },
];

const DIRECTIONS: { value: ReadingDirection; label: string }[] = [
  { value: 'ltr', label: 'Izq. → Der. (cómic)' },
  { value: 'rtl', label: 'Der. → Izq. (manga)' },
];

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const s = useSettings();

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <header className="settings__header">
          <h2>Ajustes de lectura</h2>
          <button className="btn btn--ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <section className="settings__group">
          <label className="settings__label">Tema</label>
          <div className="settings__segment">
            {THEMES.map((t) => (
              <button
                key={t.value}
                className={s.theme === t.value ? 'seg seg--active' : 'seg'}
                onClick={() => s.setTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings__group">
          <label className="settings__label">Ajuste de página</label>
          <div className="settings__segment">
            {FIT_MODES.map((f) => (
              <button
                key={f.value}
                className={s.fitMode === f.value ? 'seg seg--active' : 'seg'}
                onClick={() => s.setFitMode(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings__group">
          <label className="settings__label">Dirección de lectura</label>
          <div className="settings__segment">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                className={s.direction === d.value ? 'seg seg--active' : 'seg'}
                onClick={() => s.setDirection(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings__group">
          <label className="settings__label">
            Brillo <span className="settings__value">{Math.round(s.brightness * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.02}
            value={s.brightness}
            onChange={(e) => s.setBrightness(Number(e.target.value))}
          />
        </section>

        <section className="settings__group">
          <label className="settings__label">
            Calidez (menos luz azul){' '}
            <span className="settings__value">{Math.round(s.warmth * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={s.warmth}
            onChange={(e) => s.setWarmth(Number(e.target.value))}
          />
        </section>

        <section className="settings__group settings__group--row">
          <label className="settings__label">Barra de progreso</label>
          <button
            className={s.showProgress ? 'toggle toggle--on' : 'toggle'}
            onClick={s.toggleProgress}
            role="switch"
            aria-checked={s.showProgress}
          >
            <span className="toggle__knob" />
          </button>
        </section>
      </div>
    </div>
  );
}
