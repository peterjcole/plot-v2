'use client';

import { useState, useCallback, useEffect } from 'react';
import { type Theme, loadTheme, saveTheme, applyThemeToDocument } from '@/lib/theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'system' : loadTheme()
  );
  const [sysDark, setSysDark] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const osDark = theme === 'dark' || (theme === 'system' && sysDark);

  useEffect(() => {
    const sysMq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSysDark(e.matches);
    sysMq.addEventListener('change', handler);
    return () => sysMq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme, sysDark);
  }, [theme, sysDark]);

  const handleThemeChange = useCallback((t: Theme) => {
    setTheme(t);
    saveTheme(t);
  }, []);

  return { theme, sysDark, osDark, handleThemeChange };
}
