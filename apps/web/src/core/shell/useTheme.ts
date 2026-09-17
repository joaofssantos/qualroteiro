import { useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'qualroteiro:theme';

type Theme = 'light' | 'dark';

function getSystemMediaQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
}

function getSystemTheme(): Theme {
  return getSystemMediaQuery()?.matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : getSystemTheme();
}

/**
 * Keeps the explicit user choice in localStorage. Without one, the UI follows
 * the operating system, including later `prefers-color-scheme` changes.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;

    const mediaQuery = getSystemMediaQuery();
    if (!mediaQuery) return;
    const syncSystemTheme = () => setTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', syncSystemTheme);
    return () => mediaQuery.removeEventListener('change', syncSystemTheme);
  }, []);

  function toggleTheme(): void {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  }

  return { theme, toggleTheme } as const;
}
