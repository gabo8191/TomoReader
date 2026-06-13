import { useEffect, useState } from 'react';
import { useReader } from './useReader';
import { useSettings } from '@/lib/settings-store';
import { Icon } from '@/components/Icon';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import type { FitMode, ReadingTheme } from '@/types';
import './reader.css';

interface ReaderViewProps {
  comicId: number;
  onClose: () => void;
}

const FIT_ORDER: FitMode[] = ['height', 'width', 'original'];
const FIT_ICON = {
  height: 'fit-height',
  width: 'fit-width',
  original: 'fit-original',
} as const;
const FIT_LABEL = {
  height: 'Ajustar al alto',
  width: 'Ajustar al ancho',
  original: 'Tamaño original',
};
const THEME_ORDER: ReadingTheme[] = ['sepia', 'dark', 'oled', 'light'];

export function ReaderView({ comicId, onClose }: ReaderViewProps): JSX.Element {
  const reader = useReader(comicId);
  const settings = useSettings();
  const { fitMode, direction, brightness, warmth, theme, showProgress } = settings;
  const [showComfort, setShowComfort] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Navegación por teclado. En RTL las flechas se invierten para mangas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const forward = direction === 'rtl' ? reader.prev : reader.next;
      const backward = direction === 'rtl' ? reader.next : reader.prev;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          forward();
          break;
        case 'ArrowLeft':
          backward();
          break;
        case 'Home':
          reader.goTo(0);
          break;
        case 'End':
          reader.goTo(reader.pageCount - 1);
          break;
        case 'Escape':
          if (showComfort) setShowComfort(false);
          else onClose();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [direction, reader, onClose, showComfort]);

  const cycleFit = () =>
    settings.setFitMode(FIT_ORDER[(FIT_ORDER.indexOf(fitMode) + 1) % FIT_ORDER.length] as FitMode);
  const cycleTheme = () =>
    settings.setTheme(
      THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length] as ReadingTheme,
    );

  const fitClass = `reader__page--fit-${fitMode}`;
  // Filtro de comodidad visual: brillo reducido + calidez (menos luz azul).
  const imageFilter = `brightness(${brightness}) sepia(${warmth * 0.35}) saturate(${1 - warmth * 0.1})`;

  return (
    <div className="reader">
      <header className="reader__topbar">
        <button className="iconbtn" onClick={onClose} title="Volver a la biblioteca">
          <Icon name="back" />
        </button>

        <span className="reader__counter">
          {reader.pageCount > 0 ? `${reader.current + 1} / ${reader.pageCount}` : '—'}
        </span>

        <div className="reader__tools">
          <button className="iconbtn" onClick={cycleFit} title={FIT_LABEL[fitMode]}>
            <Icon name={FIT_ICON[fitMode]} />
          </button>
          <button
            className={`iconbtn ${showComfort ? 'iconbtn--active' : ''}`}
            onClick={() => setShowComfort((v) => !v)}
            title="Brillo y calidez"
          >
            <Icon name="brightness" />
          </button>
          <button className="iconbtn" onClick={cycleTheme} title={`Tema: ${theme}`}>
            <Icon name="theme" />
          </button>
          <button className="iconbtn" onClick={() => setShowSettings(true)} title="Más ajustes">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {/* Panel rápido de comodidad, dentro del propio lector. */}
      {showComfort && (
        <div className="comfort" onClick={(e) => e.stopPropagation()}>
          <label className="comfort__row">
            <span>
              <Icon name="brightness" size={16} /> Brillo
            </span>
            <span className="comfort__val">{Math.round(brightness * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.02}
            value={brightness}
            onChange={(e) => settings.setBrightness(Number(e.target.value))}
          />
          <label className="comfort__row">
            <span>
              <Icon name="warmth" size={16} /> Calidez
            </span>
            <span className="comfort__val">{Math.round(warmth * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={warmth}
            onChange={(e) => settings.setWarmth(Number(e.target.value))}
          />
        </div>
      )}

      {/* Zonas de clic para avanzar/retroceder (respetan dirección de lectura). */}
      <button
        className="reader__zone reader__zone--left"
        onClick={direction === 'rtl' ? reader.next : reader.prev}
        aria-label="Página anterior"
      />
      <button
        className="reader__zone reader__zone--right"
        onClick={direction === 'rtl' ? reader.prev : reader.next}
        aria-label="Página siguiente"
      />

      <div className="reader__stage">
        {reader.loading && <div className="reader__msg">Abriendo cómic…</div>}
        {reader.error && <div className="reader__msg reader__msg--error">{reader.error}</div>}
        {!reader.loading && !reader.error && reader.src && (
          <img
            className={`reader__page ${fitClass}`}
            src={reader.src}
            alt={`Página ${reader.current + 1}`}
            style={{ filter: imageFilter }}
            draggable={false}
          />
        )}
        {!reader.loading && !reader.error && !reader.src && (
          <div className="reader__msg">Cargando página…</div>
        )}
      </div>

      {showProgress && reader.pageCount > 0 && (
        <div className="reader__scrubber">
          <input
            type="range"
            min={0}
            max={reader.pageCount - 1}
            value={reader.current}
            onChange={(e) => reader.goTo(Number(e.target.value))}
            style={{ direction: direction === 'rtl' ? 'rtl' : 'ltr' }}
          />
        </div>
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
