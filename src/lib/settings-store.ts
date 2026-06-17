import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FitMode, ReadingDirection, ReadingTheme } from '@/types';

/**
 * Preferencias de lectura pensadas para reducir la fatiga visual.
 * Se persisten en localStorage (no requieren backend) y se aplican como
 * variables CSS en <html data-theme>.
 */
interface SettingsState {
  theme: ReadingTheme;
  fitMode: FitMode;
  direction: ReadingDirection;
  /** Brillo aplicado a la imagen (0.3 – 1). Reduce el blanco intenso. */
  brightness: number;
  /** Filtro de luz cálida para reducir luz azul (0 – 1). */
  warmth: number;
  /** Doble página (estilo manga/cómic impreso). */
  doublePage: boolean;
  /** Mostrar la barra de progreso inferior. */
  showProgress: boolean;
  /** Idioma materno (código ISO) usado como destino de las traducciones. */
  nativeLanguage: string;

  setTheme: (theme: ReadingTheme) => void;
  setFitMode: (fit: FitMode) => void;
  setDirection: (dir: ReadingDirection) => void;
  setBrightness: (value: number) => void;
  setWarmth: (value: number) => void;
  toggleDoublePage: () => void;
  toggleProgress: () => void;
  setNativeLanguage: (lang: string) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'sepia',
      fitMode: 'height',
      direction: 'ltr',
      brightness: 0.92,
      warmth: 0.25,
      doublePage: false,
      showProgress: true,
      nativeLanguage: 'es',

      setTheme: (theme) => set({ theme }),
      setFitMode: (fitMode) => set({ fitMode }),
      setDirection: (direction) => set({ direction }),
      setBrightness: (brightness) => set({ brightness: clamp(brightness, 0.3, 1) }),
      setWarmth: (warmth) => set({ warmth: clamp(warmth, 0, 1) }),
      toggleDoublePage: () => set((s) => ({ doublePage: !s.doublePage })),
      toggleProgress: () => set((s) => ({ showProgress: !s.showProgress })),
      setNativeLanguage: (nativeLanguage) => set({ nativeLanguage }),
    }),
    { name: 'tomo-settings' },
  ),
);
