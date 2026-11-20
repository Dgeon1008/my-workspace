'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/theme-provider';

export default function SharedProject({ id, title }: { id: string; title: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  function shareTheme() {
    if (url) frame.current?.contentWindow?.postMessage({ type: 'moa:theme', theme }, new URL(url).origin);
  }
  useEffect(() => { shareTheme(); }, [url, theme]);
  useEffect(() => {
    let active = true;
    setError('');
    setUrl('');
    void fetch(`/api/harness/${encodeURIComponent(id)}`, { method: 'POST' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '프로젝트에 연결하지 못했습니다.');
        if (active) setUrl(data.url);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '프로젝트를 열지 못했습니다.'); });
    return () => { active = false; };
  }, [id, attempt]);

  if (!url) return <div className="module-not-ready" role="status"><p>{error || `${title} 화면을 준비하고 있습니다.`}</p>{error && <button onClick={() => setAttempt(value => value + 1)}>다시 연결</button>}</div>;
  return <iframe ref={frame} title={title} src={url} onLoad={shareTheme} className="shared-project-frame" allow="clipboard-write"/>;
}
