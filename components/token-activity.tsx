'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { activityCalendar, formatTokens, seoulDay, type ActivityMode, type AccountActivityResponse, type ActivityCell } from '@/lib/token-activity';

type Tooltip = { cell: ActivityCell; left: number; top: number };
const labels: Record<ActivityMode, string> = { daily: '일별', weekly: '주간', cumulative: '누적' };

export default function TokenActivity() {
  const [data, setData] = useState<AccountActivityResponse | null>(null);
  const [mode, setMode] = useState<ActivityMode>('daily');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [today, setToday] = useState('');
  const scrollArea = useRef<HTMLDivElement>(null);
  const interval = data?.refreshIntervalMs || 60000;

  useEffect(() => {
    let alive = true;
    let requesting = false;
    const controller = new AbortController();
    async function refresh() {
      if (requesting) return;
      requesting = true;
      setRefreshing(true);
      try {
        const response = await fetch('/api/token-activity', { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '기록을 불러오지 못했습니다.');
        if (alive) { setData(result); setError(''); }
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : '자동 갱신에 실패했습니다.');
      } finally {
        requesting = false;
        if (alive) { setLoading(false); setRefreshing(false); }
      }
    }
    function onFocus() { setToday(seoulDay(new Date())); if (document.visibilityState === 'visible') void refresh(); }
    setToday(seoulDay(new Date()));
    void refresh();
    const timer = setInterval(onFocus, interval);
    document.addEventListener('visibilitychange', onFocus);
    return () => { alive = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', onFocus); };
  }, [interval]);
  useEffect(() => { if (!loading && scrollArea.current) scrollArea.current.scrollLeft = scrollArea.current.scrollWidth; }, [loading]);

  const cells = today ? activityCalendar(data?.days || [], today, mode) : [];
  const months = Array.from({ length: 53 }, (_, week) => {
    const date = cells[week * 7]?.date;
    if (!date) return '';
    return week === 0 || date.slice(0, 7) !== cells[(week - 1) * 7].date.slice(0, 7) ? `${Number(date.slice(5, 7))}월` : '';
  });
  function showTooltip(cell: ActivityCell, target: HTMLButtonElement) {
    const rect = target.getBoundingClientRect();
    setTooltip({ cell, left: Math.max(8, Math.min(window.innerWidth - 228, rect.left - 88)), top: Math.max(8, rect.top - 77) });
  }
  function tooltipText(cell: ActivityCell) {
    return `${cell.date} · ${labels[mode]} ${cell.value.toLocaleString('ko-KR')} 토큰${mode === 'weekly' ? ` · ${cell.weekStart} 시작 주` : ''}`;
  }
  const problem = error || data?.message;
  const connected = data?.status === 'ok' && data.dailyAvailable;

  return <section className="token-activity account-activity" aria-labelledby="token-heading">
    <div className="token-panel" aria-busy={loading}>
      <div className="token-panel-header">
        <h2 id="token-heading">토큰 활동</h2>
        <div className="token-mode-tabs" aria-label="토큰 집계 방식">{(Object.keys(labels) as ActivityMode[]).map(value => <button key={value} aria-pressed={mode === value} className={mode === value ? 'selected' : ''} onClick={() => { setMode(value); setTooltip(null); }}>{labels[value]}</button>)}</div>
      </div>
      {loading ? <div className="token-loading" role="status"><LoaderCircle size={17} className="animate-spin"/>계정에서 토큰 기록을 가져오는 중</div> : <>
        <div ref={scrollArea} className="token-scroll" onScroll={() => setTooltip(null)}>
          <div className="token-calendar">
            <div className="token-grid" aria-label="계정 토큰 활동, 일요일부터 토요일 순서">
              {cells.map(cell => cell.future ? <span key={cell.date} className="token-cell future"/> : <button key={cell.date} className={`token-cell level-${cell.level}`} aria-label={tooltipText(cell)} aria-describedby={tooltip?.cell.date === cell.date ? 'token-tooltip' : undefined} onMouseEnter={e => showTooltip(cell, e.currentTarget)} onMouseLeave={() => setTooltip(null)} onFocus={e => showTooltip(cell, e.currentTarget)} onBlur={() => setTooltip(null)} onClick={e => showTooltip(cell, e.currentTarget)} onKeyDown={e => { if (e.key === 'Escape') setTooltip(null); }}/>) }
            </div>
            <div className="token-months" aria-hidden="true">{months.map((label, index) => <span key={index}>{label}</span>)}</div>
          </div>
        </div>
      </>}
    </div>
    <div className="token-account-meta">
      <span className={connected ? 'token-connected' : ''}><i/>{refreshing ? '동기화 중' : connected ? '계정 자동 연동' : data?.syncedAt ? '마지막 기록 표시 중' : '연결 확인 필요'}</span>
      {data?.daysUpdatedAt && <span>갱신 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(data.daysUpdatedAt))}</span>}
      {data?.summary.lifetimeTokens !== null && data?.summary.lifetimeTokens !== undefined && <span>서버 누적 {formatTokens(data.summary.lifetimeTokens)} 토큰</span>}
    </div>
    {problem && <p className="token-error" role="status"><RefreshCw size={13}/>{problem} 약 {Math.round(interval / 1000)}초 간격으로 다시 확인합니다.</p>}
    <details className="token-import-guide"><summary>집계 기준</summary><p>로그인된 계정의 서버 토큰 통계를 화면이 열려 있는 동안 약 {Math.round(interval / 1000)}초마다 자동 조회합니다. 대화 본문이나 로그인 인증값은 읽거나 저장하지 않습니다. 서버가 반환한 날짜를 그대로 사용하며, 현재일 표시는 한국 시간을 기준으로 합니다. 날짜별 기록이 제공되지 않는 경우 0으로 덮어쓰지 않습니다. {mode === 'weekly' ? '주간은 일요일~토요일 합계를 해당 주의 각 칸에 표시합니다. ' : mode === 'cumulative' ? '누적은 서버가 제공한 날짜별 기록 중 해당일까지의 합계입니다. 서버의 전체 누적값과 다를 수 있습니다. ' : ''}이 통계가 일반 Chat 전체 대화·모든 기기·모든 사용 한도를 포함한다는 의미는 아닙니다. 기존 수동 가져오기 추정치와 합산하지 않습니다.</p></details>
    {tooltip && <div id="token-tooltip" role="tooltip" className="token-tooltip" style={{ left: tooltip.left, top: tooltip.top }}><strong>{tooltip.cell.date.replaceAll('-', '.')}</strong><span>{formatTokens(tooltip.cell.value)} 토큰</span><small>{labels[mode]} · {tooltip.cell.value.toLocaleString('ko-KR')} 토큰{mode === 'weekly' ? ` · ${tooltip.cell.weekStart} 시작 주` : ''}</small></div>}
  </section>;
}
