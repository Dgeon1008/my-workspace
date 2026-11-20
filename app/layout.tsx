import type { Metadata } from 'next';
import './globals.css';
import './theme.css';
import './home-glass.css';
import { ThemeProvider } from '@/components/theme-provider';
export const metadata: Metadata = { title: '모아 — 나의 프로젝트 작업공간', description: '흩어진 로컬 프로젝트를 한곳에. 나만의 작은 작업공간, 모아.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('moa.theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();` }}/></head><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
