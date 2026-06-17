/** Idiomas disponibles para traducir (código ISO 639-1 + nombre en español). */
export interface Language {
  code: string;
  name: string;
}

export const LANGUAGES: Language[] = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'Inglés' },
  { code: 'fr', name: 'Francés' },
  { code: 'de', name: 'Alemán' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Portugués' },
  { code: 'ja', name: 'Japonés' },
  { code: 'zh', name: 'Chino' },
  { code: 'ko', name: 'Coreano' },
  { code: 'ru', name: 'Ruso' },
];

/** Nombre legible de un idioma a partir de su código (o el código si no se conoce). */
export const languageName = (code: string | null): string =>
  LANGUAGES.find((l) => l.code === code)?.name ?? code ?? 'Auto';
