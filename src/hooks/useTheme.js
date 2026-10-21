import { useState, useEffect } from 'react';

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('fl_theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('fl_theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}
