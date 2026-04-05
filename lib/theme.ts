export type Theme = 'dark' | 'system' | 'light';

const STORAGE_KEY = 'plot-theme';

export function loadTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'system';
}

export function saveTheme(t: Theme): void {
  localStorage.setItem(STORAGE_KEY, t);
}

export function resolveTheme(t: Theme, sysDark: boolean): 'dark' | 'light' {
  if (t === 'system') return sysDark ? 'dark' : 'light';
  return t;
}

export function applyThemeToDocument(t: Theme, sysDark: boolean): void {
  const resolved = resolveTheme(t, sysDark);
  document.documentElement.dataset.theme = resolved === 'light' ? 'light' : '';
}
