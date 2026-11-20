'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Code2, Folder, HardDrive, ShieldCheck, Trash2, X } from 'lucide-react';
import TokenActivity from './token-activity';
import WorkspaceSidebar from './workspace-sidebar';
import { moduleViews } from './harness/module-views';
import type { HarnessModule } from '@/lib/harness-modules';
import type { Category } from '@/lib/category';

async function requestModules(method = 'GET', value?: unknown) {
  const response = await fetch('/api/modules', {
    method,
    headers: value ? { 'Content-Type': 'application/json' } : undefined,
    body: value ? JSON.stringify(value) : undefined,
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '프로젝트 메뉴를 불러오지 못했습니다.');
  return data;
}

async function requestCategories(method: string, value: unknown) {
  const response = await fetch('/api/categories', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '카테고리를 저장하지 못했습니다.');
  return data;
}

export default function Workspace() {
  const [modules, setModules] = useState<HarnessModule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [section, setSection] = useState('all');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingModule, setDeletingModule] = useState<HarnessModule | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [toast, setToast] = useState('');
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await requestModules();
      setModules(data.modules);
      setCategories(data.categories);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '시작 화면을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    if ((deletingModule || deletingCategory) && !deleteDialog.current?.open) deleteDialog.current?.showModal();
  }, [deletingModule, deletingCategory]);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }

  async function addCategory(name: string) {
    if (busy) throw new Error('이전 작업이 끝난 뒤 다시 시도해주세요.');
    setBusy(true);
    try {
      const data = await requestCategories('POST', { name });
      setCategories(data.categories);
      notify('카테고리를 추가했습니다.');
    } finally { setBusy(false); }
  }

  async function toggleCategory(category: Category) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await requestCategories('PATCH', { id: category.id, collapsed: !category.collapsed });
      setCategories(data.categories);
    } catch (reason) { notify(reason instanceof Error ? reason.message : '카테고리 상태를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  async function moveModule(module: HarnessModule, categoryId: string) {
    if (busy || (module.categoryId || 'uncategorized') === categoryId) return;
    setBusy(true);
    try {
      const data = await requestModules('PATCH', { id: module.id, categoryId: categoryId === 'uncategorized' ? null : categoryId });
      setModules(data.modules);
      setCategories(data.categories);
      notify(`${data.categories.find((item: Category) => item.id === categoryId)?.name || '미분류'} 카테고리로 옮겼습니다.`);
    } catch (reason) { notify(reason instanceof Error ? reason.message : '프로젝트를 옮기지 못했습니다.'); }
    finally { setBusy(false); }
  }

  async function removeModule(module: HarnessModule) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await requestModules('DELETE', { id: module.id });
      setModules(data.modules);
      setDeletingModule(null);
      if (section === `module:${module.id}`) setSection('all');
      notify('프로젝트를 메뉴에서 삭제했습니다. 소스 코드는 유지됩니다.');
    } catch (reason) { notify(reason instanceof Error ? reason.message : '프로젝트 메뉴에서 삭제하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  async function removeCategory(category: Category) {
    if (busy) return;
    setBusy(true);
    try {
      const movedCount = modules.filter(module => module.categoryId === category.id).length;
      const data = await requestCategories('DELETE', { id: category.id });
      setCategories(data.categories);
      setModules(data.modules);
      setDeletingCategory(null);
      notify(movedCount ? '카테고리를 삭제했습니다. 프로젝트는 미분류로 이동했습니다.' : '카테고리를 삭제했습니다.');
    } catch (reason) { notify(reason instanceof Error ? reason.message : '카테고리를 삭제하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  const selectedModuleId = section.startsWith('module:') ? section.slice('module:'.length) : null;
  const selectedModule = selectedModuleId ? modules.find(module => module.id === selectedModuleId) : undefined;
  const ModuleView = selectedModule ? moduleViews[selectedModule.moduleKey] : undefined;
  const moduleCount = modules.length;
  const categoryCount = categories.length;

  return <div className={`workspace-shell ${selectedModule ? 'module-open' : 'home-open'}`}>
    <WorkspaceSidebar
      modules={modules}
      categories={categories}
      section={section}
      onNavigate={setSection}
      onToggle={toggleCategory}
      onAdd={addCategory}
      onMove={(module, categoryId) => void moveModule(module, categoryId)}
      onDeleteModule={setDeletingModule}
      onDeleteCategory={setDeletingCategory}
      busy={busy}
    />

    <div className={`main-shell ${selectedModule ? 'module-shell' : 'home-shell'}`}>
      {selectedModule ? (
        ModuleView ? <ModuleView/> : <div className="module-not-ready"><Code2 size={30}/><h1>{selectedModule.name}</h1><p>이 프로젝트 화면을 모아 내부 모듈로 추가하면 이곳에서 열립니다.</p></div>
      ) : (
        <>
          <header className="topbar"><div className="breadcrumb"><span>작업공간</span><strong>시작 화면</strong></div><div className="topbar-right"><span className="connection"><i/> 로컬 하네스</span><span className="mini-avatar">M</span></div></header>
          <main className="harness-home">
            <section className="page-intro"><div><div className="eyebrow"><span/> A LITTLE SPACE, BIG POSSIBILITIES</div><h1>내 프로젝트<span className="heading-dot">.</span></h1><p>왼쪽 메뉴에서 프로젝트를 열어 작업 화면으로 이동하세요.</p></div></section>
            <section className="overview" aria-label="작업공간 현황">
              <div className="overview-item"><span className="stat-icon sage"><Folder size={20}/></span><div><span>내부 프로젝트</span><strong>{loading ? '…' : moduleCount}<small>개의 작업 화면</small></strong></div><span className="stat-decoration">01</span></div>
              <div className="overview-item"><span className="stat-icon amber"><Code2 size={20}/></span><div><span>카테고리</span><strong>{loading ? '…' : categoryCount}<small>개의 메뉴 분류</small></strong></div><span className="stat-decoration">02</span></div>
            </section>
            {error ? <div className="empty-state"><ShieldCheck size={30}/><h3>시작 화면을 불러오지 못했어요</h3><p role="alert">{error}</p><button className="secondary-button" onClick={() => void load()}>다시 불러오기</button></div> : <TokenActivity/>}
            <footer className="page-footer"><span>모아. <span>여러 작업 화면을 한곳에서</span></span><span><HardDrive size={12}/> 로컬 하네스</span></footer>
          </main>
        </>
      )}
    </div>

    {(deletingModule || deletingCategory) && <dialog ref={deleteDialog} className="project-dialog small-dialog" onCancel={event => { event.preventDefault(); if (!busy) { setDeletingModule(null); setDeletingCategory(null); } }} aria-labelledby="delete-title">
      <div className="p-7"><span className="icon-box rose"><Trash2 size={23}/></span>
        <h2 id="delete-title">{deletingModule ? '프로젝트를 메뉴에서 삭제할까요?' : '카테고리를 삭제할까요?'}</h2>
        <p className="muted">{deletingModule ? <><strong>{deletingModule.name}</strong> 메뉴를 숨깁니다.<br/>모아의 소스 코드와 실제 프로젝트 파일은 삭제되지 않습니다.</> : <><strong>{deletingCategory?.name}</strong> 카테고리가 삭제됩니다.<br/>포함된 프로젝트 화면은 미분류로 이동합니다.</>}</p>
        <div className="dialog-footer"><button className="secondary-button" disabled={busy} onClick={() => { setDeletingModule(null); setDeletingCategory(null); }}>취소</button><button className="danger-button" disabled={busy} onClick={() => { if (deletingModule) void removeModule(deletingModule); else if (deletingCategory) void removeCategory(deletingCategory); }}>{busy ? '처리 중…' : '삭제'}</button></div>
      </div>
    </dialog>}

    {toast && <div className="toast" role="status"><Check size={17}/>{toast}<button aria-label="알림 닫기" onClick={() => setToast('')}><X size={14}/></button></div>}
  </div>;
}
