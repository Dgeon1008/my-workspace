'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, Settings2, History, X, LoaderCircle, Monitor, Check } from 'lucide-react';
import type { Project } from '@/lib/project';
import type { DesktopStatus } from '@/lib/desktop-launch';

const labels = { idle: '실행 대기', launching: '실행 요청 중', running: '실행 중', unverified: '실행 확인 필요', failed: '실행 실패' };

export default function ProjectLauncher({ project }: { project: Project }) {
  const [data, setData] = useState<DesktopStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'config' | 'start' | 'history' | null>(null);
  const [file, setFile] = useState('');
  const [closed, setClosed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = data && ['launching', 'running', 'unverified'].includes(data.run.state);
  const endpoint = `/api/projects/${encodeURIComponent(project.id)}/launch`;
  async function request(method = 'GET', body?: unknown, details = false) {
    const response = await fetch(endpoint + (details ? '?details=1' : ''), { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '실행 상태를 불러오지 못했습니다.');
    return result as DesktopStatus;
  }
  useEffect(() => {
    let alive = true;
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { const result = await request(); if (alive) { setData(result); } }
      catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : '실행 상태를 확인하지 못했습니다.'); }
      finally { pending = false; }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => { alive = false; clearInterval(timer); };
    // The endpoint changes when project identity or path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.path]);
  useEffect(() => { if (mode) dialog.current?.showModal(); }, [mode]);

  async function open(next: 'config' | 'start' | 'history') {
    setError(''); setClosed(false);
    try {
      const result = await request('GET', undefined, true);
      setData(result);
      setFile(result.config?.file || '');
      setMode(next === 'start' && !result.config ? 'config' : next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '실행 정보를 불러오지 못했습니다.'); }
  }
  async function act(action: () => Promise<DesktopStatus>, closeAfter = false) {
    setBusy(true); setError('');
    try { setData(await action()); if (closeAfter) setMode(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '요청하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  return <div className="project-launcher">
    <div className="launch-status-line"><span className={`launch-status ${data?.run.state || 'idle'}`}><i/>{data ? active || data.config ? labels[data.run.state] : '실행 파일 설정 필요' : '실행 상태 확인 중'}</span><div><button type="button" className="icon-button" aria-label={`${project.name} 실행 설정`} onClick={() => void open('config')}><Settings2 size={14}/></button><button type="button" className="icon-button" aria-label={`${project.name} 실행 기록`} onClick={() => void open('history')}><History size={14}/></button></div></div>
    <button type="button" className="project-run-button" disabled={!data || busy || data.run.state === 'launching' || !data.supported} onClick={() => void open(active ? 'history' : 'start')}><Play size={13} fill="currentColor"/>{!data?.supported && data ? 'Windows에서 실행 가능' : active ? '실행 상태 보기' : data?.config ? '프로그램 실행' : '실행 파일 설정'}</button>
    {error && !mode && <p className="launch-inline-error" role="alert">{error}</p>}
    {mode && <dialog ref={dialog} className="project-dialog launch-dialog" aria-labelledby={`launch-title-${project.id}`} onCancel={event => { event.preventDefault(); if (!busy) setMode(null); }}>
      <div className="launch-dialog-body"><div className="dialog-heading"><span className="icon-box sage"><Monitor size={23}/></span><button type="button" className="icon-button" aria-label="닫기" disabled={busy} onClick={() => setMode(null)}><X size={20}/></button></div>
      <h2 id={`launch-title-${project.id}`}>{mode === 'config' ? '프로그램 실행 설정' : mode === 'start' ? '프로그램을 실행할까요?' : '실행 상태와 기록'}</h2><p className="muted">{project.name}</p>
      {mode === 'config' ? <>
        <label>실행 파일 경로<input value={file} maxLength={2048} placeholder="예: dist\MyApp.exe 또는 run_login.bat" onChange={event => setFile(event.target.value)} disabled={Boolean(active) || busy}/><small>프로젝트 폴더 안의 exe · bat · cmd 파일을 선택하세요.</small></label>
        {Boolean(data?.candidates.length) && <div className="launch-candidates"><strong>폴더에서 찾은 파일</strong>{data?.candidates.map(candidate => <button type="button" key={candidate} disabled={Boolean(active) || busy} onClick={() => setFile(candidate)} className={file === candidate ? 'selected' : ''}><Play size={11}/>{candidate}</button>)}</div>}
        <p className="launch-note">목록은 실행 가능한 확장자를 찾은 결과이며 이 프로젝트의 시작 파일이라는 뜻은 아닙니다. 파일의 용도를 확인한 뒤 지정해주세요. 저장만으로 실행되지 않으며, 프로그램은 이 프로젝트 폴더를 작업 폴더로 사용합니다.</p>
        {active && <p className="launch-note caution">실행 중이거나 실행 여부가 불명확해 설정을 변경할 수 없습니다. 프로그램을 닫은 뒤 실행 기록에서 잠금을 해제해주세요.</p>}
      </> : <>
        <div className="launch-file-summary"><small>실행 파일</small><strong>{data?.config?.target || '설정되지 않음'}</strong><small>작업 폴더</small><span>{project.path}</span></div>
        {mode === 'start' ? <p className="launch-note caution">선택한 프로그램이 모아 밖의 별도 창에서 실행됩니다. 모아는 프로그램 내부 동작을 제어하지 않습니다.{data?.config?.kind === 'script' ? ' 배치 파일이 별도 프로그램을 여는 경우 실행 여부는 프로그램 창에서 확인해야 합니다.' : ''}</p> : <><p className={`launch-state-detail ${data?.run.state}`}>{data?.run.message}</p>{data?.run.pid && <p className="launch-pid">시작 프로세스 PID {data.run.pid}</p>}
          {active && <div className="launch-acknowledge"><p>프로그램은 해당 창에서 정상 종료해주세요. 별도 창이 모두 닫혔는지 확인한 후 실행 잠금을 해제할 수 있습니다. 모아가 프로그램을 강제로 종료하지는 않습니다.</p><label className="launch-checkbox"><input type="checkbox" checked={closed} onChange={event => setClosed(event.target.checked)} disabled={busy}/>이 프로젝트의 프로그램 창을 모두 닫았습니다.</label><button type="button" className="secondary-button" disabled={!closed || busy} onClick={() => void act(() => request('POST', { action: 'acknowledgeClosed', confirmedClosed: true }))}><Check size={14}/>실행 잠금 해제</button></div>}
          <div className="launch-history"><h3>최근 실행 기록</h3><small>런처의 실행 요청과 상태 확인 기록입니다. 프로그램 내부 로그는 포함하지 않습니다.</small>{data?.events.length ? data.events.map(event => <div key={event.id}><time>{new Date(event.at).toLocaleString('ko-KR')}</time><p>{event.message}</p></div>) : <p>아직 실행 기록이 없습니다.</p>}</div>
        </>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-footer"><button type="button" className="secondary-button" disabled={busy} onClick={() => setMode(null)}>닫기</button>{mode === 'config' && data?.config && <button type="button" className="secondary-button" disabled={busy} onClick={() => void act(() => request('DELETE'), true)}>실행 파일 연결 해제</button>}{mode === 'config' && <button type="button" className="primary-button" disabled={busy || Boolean(active) || !file.trim()} onClick={() => void act(() => request('PUT', { file }), true)}>{busy ? <LoaderCircle size={15} className="animate-spin"/> : <Check size={15}/>}실행 설정 저장</button>}{mode === 'start' && <button type="button" className="primary-button" disabled={busy || Boolean(active) || !data?.config} onClick={() => void act(() => request('POST', { action: 'start', confirmedVersion: data?.config?.version }), true)}>{busy ? <LoaderCircle size={15} className="animate-spin"/> : <Play size={15}/>}확인하고 실행</button>}</div>
      </div>
    </dialog>}
  </div>;
}
