import React, { createContext, useContext, useState, useEffect } from 'react';
const ThemeContext = createContext({});
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [accentId, setAccent] = useState('blue');
  const accentColors = [
    { id: 'blue', value: '#4A9EFF' },
    { id: 'orange', value: '#F97316' },
    { id: 'purple', value: '#7C3AED' },
    { id: 'green', value: '#22C55E' },
    { id: 'red', value: '#EF4444' },
    { id: 'teal', value: '#06B6D4' },
  ];
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentId, setAccent, accentColors }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() { return useContext(ThemeContext); }
