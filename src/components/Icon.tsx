/**
 * Conjunto de iconos SVG (24×24, trazo con `currentColor`).
 * Se usan en toda la UI para una apariencia consistente.
 */
export type IconName =
  | 'back'
  | 'close'
  | 'settings'
  | 'brightness'
  | 'warmth'
  | 'fit-width'
  | 'fit-height'
  | 'fit-original'
  | 'theme'
  | 'plus'
  | 'folder'
  | 'trash'
  | 'chevron-left'
  | 'chevron-right'
  | 'book';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

const PATHS: Record<IconName, JSX.Element> = {
  back: <path d="M15 18l-6-6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  settings: (
    <>
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="8" r="2.4" />
      <circle cx="15" cy="16" r="2.4" />
    </>
  ),
  brightness: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  warmth: (
    <>
      <path d="M12 3a6 6 0 0 0 0 12 6 6 0 0 1 0-12z" />
      <path d="M12 17v4M8 19h8" />
    </>
  ),
  'fit-width': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 12h10M7 12l2-2M7 12l2 2M17 12l-2-2M17 12l-2 2" />
    </>
  ),
  'fit-height': (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M12 7v10M12 7l-2 2M12 7l2 2M12 17l-2-2M12 17l2-2" />
    </>
  ),
  'fit-original': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 4v16M15 4v16M4 9h16M4 15h16" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </>
  ),
  'chevron-left': <path d="M15 18l-6-6 6-6" />,
  'chevron-right': <path d="M9 18l6-6-6-6" />,
  book: (
    <>
      <path d="M12 6C9 4 6 4 4 5v13c2-1 5-1 8 1 3-2 6-2 8-1V5c-2-1-5-1-8 1z" />
      <path d="M12 6v13" />
    </>
  ),
};

export function Icon({ name, size = 20, className }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
