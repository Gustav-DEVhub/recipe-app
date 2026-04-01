import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function getStoredTheme(): Theme | null {
  const v = localStorage.getItem('theme');
  if (v === 'light' || v === 'dark') return v;
  return null;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
      return;
    }

    // Default to prefers-color-scheme.
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
    const initial: Theme = prefersDark ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    localStorage.setItem('theme', next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      aria-pressed={theme === 'dark'}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      {theme === 'dark' ? <Moon aria-hidden className="h-4 w-4 text-sky-300" /> : <Sun aria-hidden className="h-4 w-4 text-amber-300" />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}

