import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ACCENT_COLORS = [
  { id: 'blue',   label: 'Electric Blue', primary: '213 100% 64%', hex: '#4A9EFF' },
  { id: 'orange', label: 'Sunset Orange', primary: '25 95% 53%',   hex: '#F97316' },
  { id: 'violet', label: 'Violet',        primary: '270 80% 65%',  hex: '#A855F7' },
  { id: 'green',  label: 'Emerald',       primary: '142 70% 45%',  hex: '#22C55E' },
  { id: 'rose',   label: 'Rose',          primary: '350 80% 60%',  hex: '#F43F5E' },
  { id: 'cyan',   label: 'Cyan',          primary: '190 90% 50%',  hex: '#06B6D4' },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('app-theme') || 'dark');
  const [accentId, setAccentId] = useState(() => localStorage.getItem('app-accent') || 'blue');

  const applyTheme = (t) => {
    const root = document.documentElement;
    if (t === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      root.classList.toggle('light', !prefersDark);
    } else if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  };

  const applyAccent = (id) => {
    const color = ACCENT_COLORS.find(c => c.id === id) || ACCENT_COLORS[0];
    document.documentElement.style.setProperty('--primary', color.primary);
    document.documentElement.style.setProperty('--ring', color.primary);
    document.documentElement.style.setProperty('--sidebar-primary', color.primary);
  };

  useEffect(() => {
    applyTheme(theme);

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    applyAccent(accentId);
  }, [accentId]);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('app-theme', t);
  };

  const setAccent = (id) => {
    setAccentId(id);
    localStorage.setItem('app-accent', id);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentId, setAccent, accentColors: ACCENT_COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}