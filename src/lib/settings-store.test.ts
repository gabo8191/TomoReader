import { describe, expect, it, beforeEach } from 'vitest';
import { useSettings } from './settings-store';

describe('settings-store', () => {
  beforeEach(() => {
    // Restablece a valores por defecto entre pruebas.
    useSettings.setState({ brightness: 0.92, warmth: 0.25, doublePage: false });
  });

  it('limita el brillo al rango [0.3, 1]', () => {
    useSettings.getState().setBrightness(5);
    expect(useSettings.getState().brightness).toBe(1);

    useSettings.getState().setBrightness(0);
    expect(useSettings.getState().brightness).toBe(0.3);
  });

  it('limita la calidez al rango [0, 1]', () => {
    useSettings.getState().setWarmth(2);
    expect(useSettings.getState().warmth).toBe(1);

    useSettings.getState().setWarmth(-1);
    expect(useSettings.getState().warmth).toBe(0);
  });

  it('alterna la doble página', () => {
    expect(useSettings.getState().doublePage).toBe(false);
    useSettings.getState().toggleDoublePage();
    expect(useSettings.getState().doublePage).toBe(true);
  });
});
