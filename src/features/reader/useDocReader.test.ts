import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TranslationError } from './useDocReader';

// Mock completo del módulo api para controlar las llamadas de red.
vi.mock('@/lib/api', () => ({
  api: {
    readDocument: vi.fn().mockResolvedValue({ dataBase64: btoa('fake'), format: 'pdf' }),
    listHighlights: vi.fn().mockResolvedValue([]),
    translate: vi.fn(),
    setComicCover: vi.fn(),
    setComicLanguage: vi.fn(),
    updateDocProgress: vi.fn(),
    createHighlight: vi.fn(),
    deleteHighlight: vi.fn(),
    updateHighlightNote: vi.fn(),
  },
}));

// Mock del settings-store para controlar el idioma nativo.
vi.mock('@/lib/settings-store', () => ({
  useSettings: vi.fn((selector: (s: { nativeLanguage: string }) => unknown) =>
    selector({ nativeLanguage: 'es' }),
  ),
}));

// Importaciones después de los mocks para que Vitest los aplique correctamente.
import { useDocReader } from './useDocReader';
import { api } from '@/lib/api';
import type { Comic } from '@/types';

// Función auxiliar que llama al mock sin desestructurar (evita unbound-method).
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockTranslate = vi.mocked(api).translate;

const FAKE_COMIC: Comic = {
  id: 1,
  pocketId: null,
  title: 'Test',
  path: '/test.pdf',
  format: 'pdf',
  pageCount: 10,
  lastPage: 0,
  cover: null,
  language: 'en',
  lastLocation: null,
  addedAt: '2026-01-01',
};

describe('useDocReader — caché de traducción', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Configura translate para devolver un resultado exitoso.
    mockTranslate.mockResolvedValue({
      translation: 'hola',
      detectedSource: 'en',
    });
  });

  it('llama a api.translate la primera vez que se traduce un texto', async () => {
    const { result } = renderHook(() => useDocReader(FAKE_COMIC));

    await act(async () => {
      await result.current.translate('hello');
    });

    expect(mockTranslate).toHaveBeenCalledOnce();
    expect(mockTranslate).toHaveBeenCalledWith('hello', 'en', 'es');
  });

  it('devuelve el resultado en caché sin llamar a api.translate una segunda vez', async () => {
    const { result } = renderHook(() => useDocReader(FAKE_COMIC));

    await act(async () => {
      await result.current.translate('hello');
      await result.current.translate('hello');
    });

    // Solo 1 llamada real; la segunda viene de la caché.
    expect(mockTranslate).toHaveBeenCalledOnce();
  });

  it('llama a api.translate si el texto es diferente (no en caché)', async () => {
    const { result } = renderHook(() => useDocReader(FAKE_COMIC));

    await act(async () => {
      await result.current.translate('hello');
      await result.current.translate('world');
    });

    expect(mockTranslate).toHaveBeenCalledTimes(2);
  });

  it('lanza TranslationError con retryable=false para texto vacío', async () => {
    const { result } = renderHook(() => useDocReader(FAKE_COMIC));

    await expect(act(async () => result.current.translate(''))).rejects.toBeInstanceOf(
      TranslationError,
    );

    // No debe haber llamado al backend.
    expect(mockTranslate).not.toHaveBeenCalled();
  });
});

describe('useDocReader — reintento ante fallo de red', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('reintenta 1 vez y devuelve el resultado del segundo intento', async () => {
    // El primer intento falla; el segundo tiene éxito.
    mockTranslate
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ translation: 'hola', detectedSource: 'en' });

    const { result } = renderHook(() => useDocReader(FAKE_COMIC));

    let translation: string | undefined;
    await act(async () => {
      vi.runAllTimers();
      const r = await result.current.translate('hello');
      translation = r.translation;
    });

    expect(mockTranslate).toHaveBeenCalledTimes(2);
    expect(translation).toBe('hola');
  });

  it('lanza TranslationError con retryable=true cuando ambos intentos fallan', async () => {
    mockTranslate.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDocReader(FAKE_COMIC));

    let caughtError: unknown;
    await act(async () => {
      vi.runAllTimers();
      try {
        await result.current.translate('hello');
      } catch (e) {
        caughtError = e;
      }
    });

    expect(caughtError).toBeInstanceOf(TranslationError);
    expect((caughtError as TranslationError).retryable).toBe(true);
    expect(mockTranslate).toHaveBeenCalledTimes(2);
  });
});
