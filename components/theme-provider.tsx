'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; storageError: boolean } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, updateTheme] = useState<Theme>('light');
  const [storageError, setStorageError] = useState(false);
  const apply = (value: Theme) => { document.documentElement.dataset.theme = value; updateTheme(value); };
  useEffect(() => {
    apply(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    const system = matchMedia('(prefers-color-scheme: dark)');
    const sync = (event: StorageEvent) => {
      if (event.key === 'moa.theme') apply(event.newValue === 'dark' ? 'dark' : event.newValue === 'light' ? 'light' : system.matches ? 'dark' : 'light');
    };
    const followSystem = () => { try { if (!localStorage.getItem('moa.theme')) apply(system.matches ? 'dark' : 'light'); } catch {} };
    window.addEventListener('storage', sync);
    system.addEventListener('change', followSystem);
    return () => { window.removeEventListener('storage', sync); system.removeEventListener('change', followSystem); };
  }, []);
  function setTheme(value: Theme) {
    apply(value);
    try { localStorage.setItem('moa.theme', value); setStorageError(false); }
    catch { setStorageError(true); }
  }
  return <ThemeContext.Provider value={{ theme, setTheme, storageError }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is required');
  return value;
}

export function ThemeToggle() {
  const { theme, setTheme, storageError } = useTheme();
  return <div className="theme-control"><span>화면 모드</span><div className="theme-options" role="group" aria-label="화면 모드">
    <button type="button" aria-label="라이트 모드" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={15}/>라이트</button>
    <button type="button" aria-label="다크 모드" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={15}/>다크</button>
  </div>{storageError && <small role="status">모드 설정을 저장하지 못했습니다.</small>}</div>;
}
